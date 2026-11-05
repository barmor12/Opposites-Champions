#!/usr/bin/env bash
# =====================================================================
# אלופי ההפכים – גיבוי מסד הנתונים (pg_dump) מהקונטיינר db אל המארח
# Opposites Champions – database backup (pg_dump from the db container to the host)
#
# שימוש / Usage:
#   scripts/backup-db.sh                 # → ./backups/opposites-YYYYmmdd-HHMMSS.dump
#   BACKUP_DIR=/var/backups/opposites BACKUP_KEEP_DAYS=30 scripts/backup-db.sh
#   scripts/backup-db.sh --sql           # גם קובץ .sql.gz קריא (בנוסף ל-.dump)
#
# cron יומי (03:30) כמשתמש שמריץ docker:
#   30 3 * * * /opt/opposites/scripts/backup-db.sh >> /var/log/opposites-backup.log 2>&1
#
# הפורמט .dump הוא custom של pg_dump (דחוס) – שחזור עם scripts/restore-db.sh.
# ה-sidecar "backup" ב-docker-compose.prod.yml עושה את אותו הדבר לתוך volume בשם backups;
# הסקריפט הזה מתאים ל-cron של המארח ולגיבוי ידני לפני עדכון.
# =====================================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

WANT_SQL=0
for arg in "$@"; do
  case "$arg" in
    --sql) WANT_SQL=1 ;;
    -h|--help) sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) die "ארגומנט לא מוכר: $arg" ;;
  esac
done

need_cmd docker
load_env
require_env POSTGRES_USER POSTGRES_DB

BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
COMPOSE=("${COMPOSE_PROD[@]}")
# אם קובץ ה-prod לא רלוונטי (סטאק dev) – עדיין עובד, כי db מוגדר בקובץ הבסיסי
mkdir -p "$BACKUP_DIR"

ts="$(date +%Y%m%d-%H%M%S)"
out="${BACKUP_DIR}/opposites-${ts}.dump"
tmp="${out}.part"

log "מגבה את ${POSTGRES_DB} → ${out}"
service_running COMPOSE db || die "קונטיינר db לא רץ / db container is not running"

"${COMPOSE[@]}" exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$tmp"
mv "$tmp" "$out"
log "נוצר: ${out} ($(du -h "$out" | cut -f1))"

if [[ "$WANT_SQL" == "1" ]]; then
  sql="${BACKUP_DIR}/opposites-${ts}.sql.gz"
  "${COMPOSE[@]}" exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip -9 > "$sql"
  log "נוצר גם: ${sql}"
fi

# ניקוי גיבויים ישנים
pruned="$(find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'opposites-*.dump' -o -name 'opposites-*.sql.gz' \) -mtime +"$BACKUP_KEEP_DAYS" -print -delete || true)"
if [[ -n "$pruned" ]]; then
  log "נמחקו גיבויים ישנים מ-${BACKUP_KEEP_DAYS} ימים:"; printf '  %s\n' $pruned
fi
log "סיום / done"
