#!/usr/bin/env bash
# =====================================================================
# אלופי ההפכים – הנפקת תעודת Let's Encrypt בפעם הראשונה (certbot, webroot)
# Opposites Champions – first-time Let's Encrypt certificate issuance
#
# שימוש / Usage (על ה-VPS, אחרי שה-DNS של DOMAIN מצביע לשרת ופורטים 80/443 פתוחים):
#   scripts/init-letsencrypt.sh
#   STAGING=1 scripts/init-letsencrypt.sh            # תעודת בדיקה (ללא מגבלות קצב של LE)
#   EXTRA_DOMAINS="www.example.com" scripts/init-letsencrypt.sh   # דומיינים נוספים לאותה תעודה
#   FORCE=1 scripts/init-letsencrypt.sh              # הנפקה מחדש גם אם כבר קיימת תעודה
#
# שלבים:
#   1. העלאת nginx עם app.http-only.conf.template (אין עדיין תעודה → HTTPS היה מפיל את nginx)
#   2. certbot certonly --webroot דרך /.well-known/acme-challenge/
#   3. יצירה מחדש של nginx עם app.conf.template (HTTPS + הפניה)
# חידוש: שירות certbot ב-docker-compose.prod.yml מריץ `certbot renew` כל 12 שעות,
# ו-nginx עושה reload כל 6 שעות.
# =====================================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

need_cmd docker
load_env
require_env DOMAIN LETSENCRYPT_EMAIL

[[ "$DOMAIN" != *example.com* ]] || die "DOMAIN עדיין example.com – עדכנו את .env"

COMPOSE=("${COMPOSE_PROD[@]}")
CERT_DIR="${ROOT_DIR}/infrastructure/certbot/conf"
WWW_DIR="${ROOT_DIR}/infrastructure/certbot/www"
mkdir -p "$CERT_DIR" "$WWW_DIR"

domain_args=(-d "$DOMAIN")
for d in ${EXTRA_DOMAINS:-}; do domain_args+=(-d "$d"); done

extra_args=()
if [[ "${STAGING:-0}" == "1" ]]; then
  extra_args+=(--staging)
  warn "מצב STAGING – התעודה לא תהיה מהימנה בדפדפן (לבדיקה בלבד)"
fi
if [[ "${FORCE:-0}" == "1" ]]; then
  extra_args+=(--force-renewal)
fi

if [[ -d "${CERT_DIR}/live/${DOMAIN}" && "${FORCE:-0}" != "1" ]]; then
  log "כבר קיימת תעודה עבור ${DOMAIN} ב-${CERT_DIR}/live/${DOMAIN}"
  log "להנפקה מחדש: FORCE=1 scripts/init-letsencrypt.sh ; לחידוש – שירות certbot מטפל אוטומטית"
  exit 0
fi

log "שלב 1/3: מעלה את הסטאק עם nginx במצב HTTP בלבד (bootstrap)…"
cd "$ROOT_DIR"
NGINX_TEMPLATE=app.http-only.conf.template "${COMPOSE[@]}" up -d --force-recreate nginx

log "בודק שה-ACME path נענה מקומית…"
for i in $(seq 1 15); do
  if "${COMPOSE[@]}" exec -T nginx wget -qO- http://127.0.0.1/nginx-health >/dev/null 2>&1; then break; fi
  sleep 2
  [[ "$i" -lt 15 ]] || die "nginx לא עלה – בדקו: ${COMPOSE[*]} logs nginx"
done

log "שלב 2/3: מבקש תעודה מ-Let's Encrypt עבור: ${domain_args[*]}"
"${COMPOSE[@]}" run --rm --entrypoint certbot certbot certonly \
  --webroot -w /var/www/certbot \
  "${domain_args[@]}" \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos --no-eff-email \
  --rsa-key-size 4096 \
  --non-interactive \
  "${extra_args[@]}"

[[ -f "${CERT_DIR}/live/${DOMAIN}/fullchain.pem" ]] || die "התעודה לא נוצרה – בדקו DNS (A/AAAA ל-${DOMAIN}) ושפורט 80 פתוח מהאינטרנט"

log "שלב 3/3: מחליף ל-HTTPS (app.conf.template) ומפעיל את שירות החידוש…"
"${COMPOSE[@]}" up -d --force-recreate nginx
"${COMPOSE[@]}" up -d certbot

log "הושלם! בדקו: https://${DOMAIN}/api/health"
log "תוקף התעודה: $("${COMPOSE[@]}" run --rm --entrypoint sh certbot -c "certbot certificates 2>/dev/null | grep -i 'expiry' || true")"
