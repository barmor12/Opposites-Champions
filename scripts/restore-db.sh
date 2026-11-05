#!/usr/bin/env bash
# =====================================================================
# אלופי ההפכים – שחזור מסד נתונים מגיבוי
# Opposites Champions – restore the database from a backup
#
# שימוש / Usage:
#   scripts/restore-db.sh backups/opposites-20250101-033000.dump     # pg_restore (custom format)
#   scripts/restore-db.sh backups/opposites-20250101-033000.sql.gz   # psql (plain SQL)
#   FORCE=1 scripts/restore-db.sh <file>                             # ללא שאלת אישור
#
# מה קורה:
#   1. עצירת השרת (כדי שלא יכתוב בזמן השחזור)
#   2. pg_restore --clean --if-exists  (דורס את הטבלאות הקיימות!)  /  psql לקובץ SQL
#   3. הפעלת השרת מחדש (ה-entrypoint מריץ migrate deploy – מיישר מיגרציות אם הגיבוי ישן)
#
# שחזור מה-sidecar: docker compose cp backup:/backups/<file> ./backups/ ואז הסקריפט.
# =====================================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[[ $# -eq 1 ]] || { sed -n '2,18p' "${BASH_SOURCE[0]}"; exit 1; }
file="$1"
[[ -f "$file" ]] || die "הקובץ לא נמצא / file not found: $file"

need_cmd docker
load_env
require_env POSTGRES_USER POSTGRES_DB
COMPOSE=("${COMPOSE_PROD[@]}")

warn "השחזור ידרוס את כל הנתונים הנוכחיים במסד '${POSTGRES_DB}'!"
confirm "להמשיך בשחזור מ-${file}?" || die "בוטל / aborted"

"${COMPOSE[@]}" ps --status running db >/dev/null 2>&1 || die "קונטיינר db לא רץ"

log "עוצר את השרת…"
"${COMPOSE[@]}" stop server >/dev/null 2>&1 || true

# ניתוק חיבורים פתוחים כדי ש-DROP יצליח
"${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -q -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" >/dev/null

case "$file" in
  *.dump)
    log "pg_restore (custom format)…"
    "${COMPOSE[@]}" exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      --clean --if-exists --no-owner --no-privileges --exit-on-error < "$file"
    ;;
  *.sql.gz)
    log "psql (plain SQL, gzip)…"
    gunzip -c "$file" | "${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q
    ;;
  *.sql)
    log "psql (plain SQL)…"
    "${COMPOSE[@]}" exec -T db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q < "$file"
    ;;
  *)
    die "סיומת לא נתמכת (.dump / .sql / .sql.gz): $file"
    ;;
esac

log "מפעיל את השרת מחדש (migrate deploy ירוץ אוטומטית)…"
"${COMPOSE[@]}" up -d server
log "השחזור הושלם / restore complete"
