# תשתית Docker – אינדקס

מפת הקבצים של הפריסה (Docker / nginx / סקריפטים). ההוראות המלאות ב-[`docs/DEPLOYMENT.md`](../../docs/DEPLOYMENT.md), פיתוח ב-Windows ב-[`docs/WINDOWS_DEV.md`](../../docs/WINDOWS_DEV.md).

| קובץ | תפקיד |
|---|---|
| `docker-compose.yml` | סטאק מקומי מלא: `db` (PostgreSQL 16), `server` (NestJS), `web` (nginx + SPA על 8080). ה-DB לא חשוף למארח. |
| `docker-compose.prod.yml` | override לפרודקשן: `nginx` (80/443, TLS), `certbot` (חידוש), `backup` (pg_dump יומי), ביטול פורט ה-web, לוגים מוגבלים. |
| `.dockerignore` | מה לא נכנס ל-build context (node_modules, dist, .git, `.env*` למעט `.env.example`). |
| `apps/server/Dockerfile` | multi-stage: builder (pnpm, prisma generate, nest build, `pnpm deploy --prod`) → runtime רזה (node:22-alpine, משתמש `node`, HEALTHCHECK). |
| `apps/server/docker-entrypoint.sh` | `prisma migrate deploy` → seed (אם `RUN_SEED=true`) → `node dist/apps/server/src/main.js`. |
| `apps/web/Dockerfile` | builder (Vite, `VITE_API_URL` ברירת מחדל `/api`) → `nginx:1.27-alpine` עם `infrastructure/nginx/web.conf`. |
| `infrastructure/nginx/nginx.conf` | nginx ראשי (פרודקשן): gzip, rate-limit zones, WebSocket map, resolver של Docker, real-IP. |
| `infrastructure/nginx/conf.d/app.conf.template` | HTTP→HTTPS + ACME, HTTPS עם Let's Encrypt, `/api/`, `/socket.io/`, `/` → web, HSTS. `${DOMAIN}` מוחלף ע"י envsubst. |
| `infrastructure/nginx/conf.d/app.http-only.conf.template` | קונפיגורציית bootstrap ב-HTTP בלבד – לפני שיש תעודה. |
| `infrastructure/nginx/web.conf` | nginx בתוך קונטיינר ה-web: SPA fallback, cache, כותרות אבטחה, proxy ל-/api בסטאק המקומי. |
| `infrastructure/nginx/snippets/*.conf` | קטעים משותפים: proxy headers, WebSocket, TLS params, security headers. |
| `infrastructure/certbot/` | (לא ב-git) `conf/` = `/etc/letsencrypt`, `www/` = ACME webroot. |
| `scripts/init-letsencrypt.sh` | הנפקת תעודה ראשונה ומעבר ל-HTTPS. |
| `scripts/deploy.sh` | עדכון: git pull → גיבוי → build → up → migrate → prune. |
| `scripts/backup-db.sh` / `scripts/restore-db.sh` | גיבוי/שחזור `pg_dump`/`pg_restore` דרך הקונטיינר. |
| `scripts/dev-db.sh` | PostgreSQL מקומי לפיתוח (קונטיינר בודד). |
| `scripts/lib.sh` | פונקציות משותפות (טעינת `.env`, פקודת compose, לוגים). |

## פקודות מהירות

```bash
# מקומי (סטאק מלא)
cp .env.example .env && docker compose up -d --build        # http://localhost:8080

# פרודקשן
scripts/init-letsencrypt.sh                                  # פעם אחת
scripts/deploy.sh                                            # כל עדכון
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f server nginx
```
