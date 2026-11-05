#!/bin/sh
# =====================================================================
# אלופי ההפכים – entrypoint של קונטיינר השרת
# Opposites Champions – server container entrypoint
#
# סדר פעולות / Order:
#   1. המתנה למסד הנתונים (ניסיונות חוזרים על prisma migrate deploy)
#   2. prisma migrate deploy   – הרצת כל המיגרציות שטרם הורצו (idempotent)
#   3. seed (רק אם RUN_SEED=true) – tsx prisma/seed.ts (יוצר מורה ראשונית + תוכן)
#   4. exec "$@"                – node dist/apps/server/src/main.js (ה-CMD מה-Dockerfile)
#
# משתני סביבה / Env:
#   DATABASE_URL           חובה
#   RUN_SEED=true          להריץ seed בעלייה (ברירת מחדל: false)
#   SKIP_MIGRATIONS=true   לדלג על migrate deploy (למשל כשמריצים ידנית)
#   MIGRATE_RETRIES=30     מספר ניסיונות (כל 2 שניות) עד שה-DB זמין
# =====================================================================
set -eu

cd /app/apps/server

log() { printf '[entrypoint] %s\n' "$*"; }

if [ -z "${DATABASE_URL:-}" ]; then
  log "ERROR: DATABASE_URL is not set / DATABASE_URL חסר"
  exit 1
fi

if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
  retries="${MIGRATE_RETRIES:-30}"
  attempt=1
  log "running prisma migrate deploy (up to ${retries} attempts)…"
  until prisma migrate deploy; do
    if [ "$attempt" -ge "$retries" ]; then
      log "ERROR: migrations failed after ${retries} attempts / המיגרציות נכשלו"
      exit 1
    fi
    attempt=$((attempt + 1))
    log "database not ready yet, retrying in 2s (attempt ${attempt}/${retries})…"
    sleep 2
  done
  log "migrations applied / המיגרציות הושלמו"
else
  log "SKIP_MIGRATIONS=true – skipping prisma migrate deploy"
fi

if [ "${RUN_SEED:-false}" = "true" ]; then
  log "RUN_SEED=true – running seed (tsx prisma/seed.ts)…"
  tsx prisma/seed.ts
  log "seed finished / ה-seed הסתיים"
fi

log "starting: $*"
exec "$@"
