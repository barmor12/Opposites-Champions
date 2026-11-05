#!/usr/bin/env bash
# =====================================================================
# אלופי ההפכים – פריסה/עדכון בפרודקשן
# Opposites Champions – production deploy / update
#
# שימוש / Usage (על ה-VPS, מתוך שורש הריפו או מכל מקום):
#   scripts/deploy.sh                 # git pull → backup → build → up -d → migrate → prune
#   scripts/deploy.sh --no-pull       # בלי git pull (למשל אחרי העתקה ידנית)
#   scripts/deploy.sh --no-backup     # בלי גיבוי לפני העדכון (לא מומלץ)
#   scripts/deploy.sh --seed          # להריץ seed אחרי העלייה (RUN_SEED=true)
#   GIT_BRANCH=main scripts/deploy.sh
#
# המיגרציות רצות אוטומטית ב-entrypoint של השרת; הסקריפט מריץ migrate deploy במפורש
# פעם נוספת (idempotent) כדי להציג את הסטטוס ולוודא שהכול מיושר.
# =====================================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DO_PULL=1; DO_BACKUP=1; DO_SEED=0
for arg in "$@"; do
  case "$arg" in
    --no-pull)   DO_PULL=0 ;;
    --no-backup) DO_BACKUP=0 ;;
    --seed)      DO_SEED=1 ;;
    -h|--help)   sed -n '2,16p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "ארגומנט לא מוכר: $arg" ;;
  esac
done

need_cmd docker
need_cmd git
load_env
require_env DOMAIN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_SECRET COOKIE_SECRET
COMPOSE=("${COMPOSE_PROD[@]}")
cd "$ROOT_DIR"

[[ "$JWT_SECRET" != change-me* && "$COOKIE_SECRET" != change-me* && "$POSTGRES_PASSWORD" != change-me* ]] \
  || die "ב-.env עדיין ערכי change-me – החליפו סודות לפני פריסה"

if [[ "$DO_PULL" == "1" ]]; then
  branch="${GIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
  log "git pull --ff-only origin ${branch}…"
  git fetch --prune origin
  git checkout -q "$branch"
  git pull --ff-only origin "$branch"
fi
log "גרסה: $(git rev-parse --short HEAD) ($(git log -1 --pretty=%s))"

if [[ "$DO_BACKUP" == "1" ]]; then
  if service_running db; then
    log "גיבוי לפני עדכון…"
    "${ROOT_DIR}/scripts/backup-db.sh"
  else
    warn "db לא רץ – מדלג על גיבוי (פריסה ראשונה?)"
  fi
fi

log "בונה אימג'ים (server, web)…"
"${COMPOSE[@]}" build --pull server web

log "מעלה את הסטאק…"
if [[ "$DO_SEED" == "1" ]]; then
  RUN_SEED=true "${COMPOSE[@]}" up -d --remove-orphans
else
  "${COMPOSE[@]}" up -d --remove-orphans
fi

log "ממתין לשרת (health)…"
for i in $(seq 1 60); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$("${COMPOSE[@]}" ps -q server)" 2>/dev/null || echo unknown)"
  [[ "$status" == "healthy" ]] && break
  sleep 3
  [[ "$i" -lt 60 ]] || { "${COMPOSE[@]}" logs --tail=80 server; die "השרת לא הגיע ל-healthy תוך 3 דקות"; }
done
log "השרת healthy"

log "סטטוס מיגרציות (prisma migrate deploy – idempotent)…"
"${COMPOSE[@]}" exec -T server prisma migrate deploy

log "מנקה אימג'ים ישנים…"
docker image prune -f >/dev/null

log "בדיקה סופית: https://${DOMAIN}/api/health"
if command -v curl >/dev/null 2>&1; then
  curl -fsS --max-time 10 "https://${DOMAIN}/api/health" && echo || warn "הבדיקה החיצונית נכשלה – בדקו nginx/תעודה/DNS"
else
  warn "curl לא מותקן – דלגו על הבדיקה החיצונית (sudo apt install curl)"
fi

"${COMPOSE[@]}" ps
log "הפריסה הושלמה / deploy complete"
