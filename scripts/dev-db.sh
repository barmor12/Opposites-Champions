#!/usr/bin/env bash
# =====================================================================
# אלופי ההפכים – PostgreSQL מקומי לפיתוח (קונטיינר בודד, בלי כל הסטאק)
# Opposites Champions – local PostgreSQL for development (single container)
#
# שימוש / Usage (Linux / macOS / Windows Git Bash או WSL):
#   scripts/dev-db.sh            # = start
#   scripts/dev-db.sh start      # מפעיל postgres:16-alpine על 127.0.0.1:5432 עם volume קבוע
#   scripts/dev-db.sh stop       # עוצר (הנתונים נשמרים)
#   scripts/dev-db.sh restart
#   scripts/dev-db.sh logs
#   scripts/dev-db.sh psql       # מעטפת psql בתוך הקונטיינר (ב-Git Bash: winpty bash scripts/dev-db.sh psql)
#   scripts/dev-db.sh reset      # מוחק את הקונטיינר + הנתונים ומתחיל מחדש
#   scripts/dev-db.sh status
#
# הערכים (משתמש/סיסמה/DB/פורט) נקראים מ-.env אם קיים, אחרת ברירות המחדל של .env.example.
# אחרי ההפעלה: pnpm --filter @oc/server prisma:migrate:dev && pnpm db:seed
# =====================================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

need_cmd docker
[[ -f "${ROOT_DIR}/.env" ]] && load_env

CONTAINER="${DEV_DB_CONTAINER:-opposites-dev-db}"
VOLUME="${DEV_DB_VOLUME:-opposites-dev-pgdata}"
IMAGE="${DEV_DB_IMAGE:-postgres:16-alpine}"
PG_USER="${POSTGRES_USER:-opposites}"
PG_PASS="${POSTGRES_PASSWORD:-change-me-strong-password}"
PG_DB="${POSTGRES_DB:-opposites}"
PG_PORT="${DEV_DB_PORT:-5432}"

cmd="${1:-start}"

exists()  { docker container inspect "$CONTAINER" >/dev/null 2>&1; }
running() { [[ "$(docker container inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || echo false)" == "true" ]]; }

start() {
  if running; then log "הקונטיינר ${CONTAINER} כבר רץ"; return; fi
  if exists; then
    log "מפעיל קונטיינר קיים ${CONTAINER}…"; docker start "$CONTAINER" >/dev/null
  else
    log "יוצר ${CONTAINER} (${IMAGE}) על 127.0.0.1:${PG_PORT}, volume ${VOLUME}…"
    docker run -d --name "$CONTAINER" \
      -e POSTGRES_USER="$PG_USER" -e POSTGRES_PASSWORD="$PG_PASS" -e POSTGRES_DB="$PG_DB" \
      -p "127.0.0.1:${PG_PORT}:5432" \
      -v "${VOLUME}:/var/lib/postgresql/data" \
      --restart unless-stopped \
      "$IMAGE" >/dev/null
  fi
  log "ממתין ל-PostgreSQL…"
  for i in $(seq 1 30); do
    if docker exec "$CONTAINER" pg_isready -q -U "$PG_USER" -d "$PG_DB" 2>/dev/null; then
      log "מוכן. DATABASE_URL=postgresql://${PG_USER}:***@localhost:${PG_PORT}/${PG_DB}?schema=public"
      log "עכשיו: pnpm --filter @oc/server prisma:migrate:dev && pnpm db:seed"
      return
    fi
    sleep 1
  done
  die "PostgreSQL לא עלה – docker logs ${CONTAINER}"
}

case "$cmd" in
  start)   start ;;
  stop)    exists && docker stop "$CONTAINER" >/dev/null && log "נעצר" || log "לא קיים" ;;
  restart) exists && docker restart "$CONTAINER" >/dev/null && log "הופעל מחדש" || start ;;
  logs)    docker logs -f "$CONTAINER" ;;
  psql)    docker exec -it "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" ;;
  status)  if running; then log "${CONTAINER}: running"; docker port "$CONTAINER"; else log "${CONTAINER}: not running"; fi ;;
  reset)
    confirm "למחוק את הקונטיינר ${CONTAINER} ואת כל הנתונים ב-${VOLUME}?" || die "בוטל"
    exists && docker rm -f "$CONTAINER" >/dev/null || true
    docker volume rm -f "$VOLUME" >/dev/null 2>&1 || true
    start ;;
  -h|--help|help) sed -n '2,20p' "${BASH_SOURCE[0]}" ;;
  *) die "פקודה לא מוכרת: $cmd (start|stop|restart|logs|psql|status|reset)" ;;
esac
