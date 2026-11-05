#!/usr/bin/env bash
# =====================================================================
# אלופי ההפכים – פונקציות משותפות לסקריפטים (נטען עם `source`)
# Opposites Champions – shared helpers for scripts (sourced, not executed)
#
# מספק:
#   ROOT_DIR          – שורש הריפו
#   COMPOSE_PROD      – מערך הפקודה: docker compose -f docker-compose.yml -f docker-compose.prod.yml
#   load_env [file]   – טעינת .env (מתעלם מהערות, מסיר CRLF של Windows ומרכאות עוטפות)
#   require_env VAR…  – עצירה אם משתנה חסר
#   log / warn / die  – הודעות
#   confirm "שאלה"    – אישור אינטראקטיבי (y/N); FORCE=1 מדלג
# =====================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_PROD=(docker compose -f "${ROOT_DIR}/docker-compose.yml" -f "${ROOT_DIR}/docker-compose.prod.yml")
COMPOSE_DEV=(docker compose -f "${ROOT_DIR}/docker-compose.yml")

log()  { printf '\033[1;34m[oc]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[oc] אזהרה / warning:\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[oc] שגיאה / error:\033[0m %s\n' "$*" >&2; exit 1; }

# load_env [path] – ברירת מחדל: $ROOT_DIR/.env
load_env() {
  local file="${1:-${ROOT_DIR}/.env}" line key val
  [[ -f "$file" ]] || die "קובץ ${file} לא נמצא. צרו אותו: cp .env.example .env  / .env not found"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"                       # CRLF (Windows) → LF
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *"="* ]] || continue
    key="${line%%=*}"; val="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"; key="${key%"${key##*[![:space:]]}"}"   # trim
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # הסרת מרכאות עוטפות (כמו ש-docker compose עושה)
    if [[ "$val" =~ ^\"(.*)\"$ ]]; then val="${BASH_REMATCH[1]}"; elif [[ "$val" =~ ^\'(.*)\'$ ]]; then val="${BASH_REMATCH[1]}"; fi
    # משתנה שכבר קיים בסביבה גובר על .env (כמו ב-compose)
    if [[ -z "${!key+x}" ]]; then export "$key=$val"; fi
  done < "$file"
}

require_env() {
  local v
  for v in "$@"; do
    [[ -n "${!v:-}" ]] || die "המשתנה ${v} חסר ב-.env / missing env var: ${v}"
  done
}

confirm() {
  [[ "${FORCE:-0}" == "1" ]] && return 0
  local answer
  read -r -p "$1 [y/N] " answer
  [[ "$answer" =~ ^[Yy]([Ee][Ss])?$ ]]
}

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "הפקודה '$1' לא נמצאה / command not found: $1"; }

# service_running <compose-array-name> <service> – האם לשירות יש קונטיינר במצב running
# (docker compose ps מחזיר 0 גם כשאין תוצאות, לכן בודקים את הפלט)
service_running() {
  local -n _compose="$1"
  [[ -n "$("${_compose[@]}" ps -q --status running "$2" 2>/dev/null)" ]]
}
