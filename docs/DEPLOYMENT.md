# פריסה לפרודקשן – אלופי ההפכים

מדריך פריסה מלא של המשחק על שרת VPS (Ubuntu) עם Docker Compose, nginx ו-Let's Encrypt.
אינדקס קבצי התשתית: [`infrastructure/docker/README.md`](../infrastructure/docker/README.md).

## תוכן

1. [ארכיטקטורה](#1-ארכיטקטורה)
2. [דרישות מוקדמות ב-VPS](#2-דרישות-מוקדמות-ב-vps)
3. [DNS](#3-dns)
4. [קבלת הקוד ויצירת `.env`](#4-קבלת-הקוד-ויצירת-env)
5. [הרצה ראשונה: תעודת TLS](#5-הרצה-ראשונה-תעודת-tls)
6. [הפעלה, מיגרציות ו-seed](#6-הפעלה-מיגרציות-ו-seed)
7. [מורה ראשונית](#7-מורה-ראשונית)
8. [בדיקות תקינות (health)](#8-בדיקות-תקינות-health)
9. [לוגים](#9-לוגים)
10. [עדכון גרסה](#10-עדכון-גרסה)
11. [גיבוי ושחזור](#11-גיבוי-ושחזור)
12. [חידוש תעודה](#12-חידוש-תעודה)
13. [פתרון תקלות](#13-פתרון-תקלות)
14. [אבטחה](#14-אבטחה)
15. [סטאק מקומי מלא (ללא TLS)](#15-סטאק-מקומי-מלא-ללא-tls)

---

## 1. ארכיטקטורה

```
אינטרנט ──► :80/:443  nginx (TLS, rate-limit, gzip)
                         ├── /api/*        ──► server:3000  (NestJS, prefix /api)
                         ├── /socket.io/*  ──► server:3000  (Socket.IO, WebSocket upgrade)
                         └── /*            ──► web:80       (nginx + SPA של Vite)
             server ──► db:5432 (PostgreSQL 16, רשת פנימית בלבד)
             certbot  – חידוש תעודות (כל 12 שעות)
             backup   – pg_dump יומי ל-volume "backups" (שמירה 14 יום)
```

* **רשתות**: `backend` (פנימית, ללא יציאה לאינטרנט) – `db`, `server`, `backup`. `frontend` – `nginx`, `web`, `server`.
* **ה-DB לעולם לא חשוף למארח** – גישה רק מתוך הקונטיינרים.
* **קבצי compose**: `docker-compose.yml` (בסיס) + `docker-compose.prod.yml` (override לפרודקשן). תמיד מריצים את שניהם יחד:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml <פקודה>
  ```

  כדי לקצר, אפשר להגדיר פעם אחת: `export COMPOSE_FILE=docker-compose.yml:docker-compose.prod.yml` ואז `docker compose <פקודה>` מספיק. הסקריפטים ב-`scripts/` כבר עושים זאת לבד.

## 2. דרישות מוקדמות ב-VPS

* **שרת**: Ubuntu 22.04/24.04 LTS, לפחות 1 vCPU, 2GB RAM (הבנייה של האימג'ים דורשת זיכרון; עם 1GB – להוסיף swap), 20GB דיסק.
* **משתמש רגיל עם sudo** (לא להריץ הכול כ-root):

  ```bash
  adduser deploy && usermod -aG sudo deploy
  ```

* **Docker Engine + Compose plugin** (דרוש Compose **v2.24+**):

  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER      # להתנתק ולהתחבר מחדש
  docker --version && docker compose version
  ```

* **חומת אש (ufw)** – רק SSH, HTTP ו-HTTPS:

  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow 22/tcp      # SSH (אם שיניתם פורט – להתאים!)
  sudo ufw allow 80/tcp      # HTTP (ACME + הפניה)
  sudo ufw allow 443/tcp     # HTTPS
  sudo ufw enable && sudo ufw status
  ```

  > הערה: Docker מוסיף כללי iptables משלו ועוקף את ufw עבור פורטים שממופים ב-`ports:`. לכן ב-compose ממופים למארח **רק** 80 ו-443 של nginx. ה-DB וה-server אינם ממופים כלל.

* **כלים נוספים**: `git`, `curl` (`sudo apt install -y git curl`).
* מומלץ: `unattended-upgrades` לעדכוני אבטחה, ו-`fail2ban` ל-SSH.

## 3. DNS

אצל ספק הדומיין, צרו רשומות שמצביעות ל-IP של ה-VPS:

| סוג | שם | ערך |
|---|---|---|
| `A` | `opposites.example.com` (או `@` לדומיין הראשי) | IPv4 של השרת |
| `AAAA` | אותו שם | IPv6 של השרת (אם יש; אחרת לא ליצור) |

* המשחק מוגש מדומיין אחד – **`DOMAIN` ב-`.env`** (למשל תת-דומיין `opposites.school-name.org`). אם רוצים גם `www.`, יוצרים רשומה נוספת ומוסיפים אותה לתעודה: `EXTRA_DOMAINS="www.opposites.example.com" scripts/init-letsencrypt.sh` ולהוסיף אותה ל-`server_name` ב-template.
* ממתינים ש-DNS יתפשט לפני הנפקת התעודה: `dig +short opposites.example.com` חייב להחזיר את ה-IP של השרת.
* אם משתמשים ב-Cloudflare: בשלב הנפקת התעודה הראשונה השאירו את הרשומה במצב "DNS only" (ענן אפור). אחרי שיש תעודה אפשר להפעיל proxy ולהגדיר `real_ip` ב-`infrastructure/nginx/nginx.conf` (ראו הערה בקובץ).

## 4. קבלת הקוד ויצירת `.env`

```bash
sudo mkdir -p /opt/opposites && sudo chown $USER:$USER /opt/opposites
git clone <REPO_URL> /opt/opposites
cd /opt/opposites
cp .env.example .env
chmod 600 .env
nano .env
```

ערכים שחובה לשנות ב-`.env` לפרודקשן:

| משתנה | ערך לפרודקשן | הערות |
|---|---|---|
| `NODE_ENV` | `production` | (ה-compose דורס ל-production בכל מקרה) |
| `DOMAIN` | `opposites.example.com` | הדומיין מה-DNS, **בלי** `https://` |
| `LETSENCRYPT_EMAIL` | כתובת אמיתית | התראות על פקיעת תעודה |
| `APP_URL` | `https://opposites.example.com` | כתובת ציבורית של האתר (קישורי הצטרפות/QR) |
| `API_URL` | `https://opposites.example.com/api` | |
| `CORS_ORIGINS` | `https://opposites.example.com` | מופרד בפסיקים אם יש כמה |
| `POSTGRES_PASSWORD` | סיסמה חזקה | **ללא** התווים `@ : / # % ?` (נכנסת ל-URL) או לקודד אותה URL-encoded |
| `JWT_SECRET`, `COOKIE_SECRET` | מחרוזות אקראיות ≥ 32 תווים | `openssl rand -base64 48` |
| `TEACHER_INITIAL_EMAIL/PASSWORD/NAME` | פרטי המורה הראשונית | נוצרת ב-seed (ראו §7) |
| `LOG_LEVEL` | `info` | `debug` לאבחון בלבד |

`DATABASE_URL` ב-`.env` יכול להישאר כפי שהוא – ה-compose דורס אותו עבור קונטיינר השרת לכתובת הפנימית `db:5432` (ומשתמש ב-`POSTGRES_*`).

משתנים אופציונליים: `BACKUP_KEEP_DAYS` (ברירת מחדל 14), `IMAGE_TAG` (תגית לאימג'ים), `RUN_SEED` (ראו §6).

> **לעולם לא** לשמור את `.env` ב-git (הוא ב-`.gitignore`) ולא לשלוח אותו בצ'אט/מייל.

## 5. הרצה ראשונה: תעודת TLS

nginx בקונפיגורציית ה-HTTPS לא יכול לעלות בלי תעודה, ו-certbot לא יכול להנפיק תעודה בלי nginx שעונה ב-HTTP. הסקריפט פותר את "הביצה והתרנגולת":

```bash
cd /opt/opposites
scripts/init-letsencrypt.sh
```

מה הסקריפט עושה:

1. מעלה את `nginx` עם `app.http-only.conf.template` (HTTP בלבד, כולל `/.well-known/acme-challenge/`).
2. מריץ `certbot certonly --webroot` – התעודה נשמרת ב-`infrastructure/certbot/conf/live/<DOMAIN>/`.
3. יוצר מחדש את `nginx` עם `app.conf.template` (HTTPS + הפניה מ-HTTP) ומפעיל את שירות החידוש `certbot`.

לבדיקה ללא מגבלות הקצב של Let's Encrypt (5 כשלונות לשעה): `STAGING=1 scripts/init-letsencrypt.sh`, ואחרי שהצליח – `FORCE=1 scripts/init-letsencrypt.sh` לתעודה אמיתית.

הסקריפט מעלה רק את nginx (ואת שאר השירותים כ-dependencies). את הסטאק המלא מעלים בשלב הבא.

## 6. הפעלה, מיגרציות ו-seed

```bash
cd /opt/opposites
scripts/deploy.sh --no-pull --seed     # פריסה ראשונה: בנייה, עלייה, מיגרציות, seed
```

או ידנית:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
RUN_SEED=true docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

* **מיגרציות** – `apps/server/docker-entrypoint.sh` מריץ `prisma migrate deploy` **בכל עלייה** של קונטיינר השרת (idempotent – מריץ רק מיגרציות שטרם הורצו, וממתין ל-DB עד 60 שניות). להרצה ידנית:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec server prisma migrate deploy
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec server prisma migrate status
  ```

* **Seed** (`apps/server/prisma/seed.ts` – יוצר את המורה הראשונית ואת מאגר צמדי המילים) רץ רק כאשר `RUN_SEED=true`. ה-seed אמור להיות idempotent (לא יוצר כפילויות), אבל אין צורך להריץ אותו בכל עלייה. הרצה ידנית לאחר מכן:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.prod.yml exec server tsx prisma/seed.ts
  ```

  > ה-seed מיובא כ-TypeScript (tsx) ומשתמש בחבילות `@oc/shared`/`@oc/content`; אימג' השרת כולל אותן (עותק של `src/`) בתוך `node_modules/@oc/*`, לכן הפקודה עובדת גם בפרודקשן.

* הבנייה הראשונה אורכת כמה דקות (הורדת תלויות, קומפילציה). בניות חוזרות מהירות בזכות cache של pnpm.

## 7. מורה ראשונית

ה-seed יוצר משתמש מורה אם אינו קיים, לפי `.env`:

```
TEACHER_INITIAL_EMAIL=teacher@example.com
TEACHER_INITIAL_PASSWORD=...
TEACHER_INITIAL_NAME=המורה
```

* התחברות: `https://<DOMAIN>/` → מסך מורה → `POST /api/auth/login`.
* **מיד אחרי ההתחברות הראשונה החליפו את הסיסמה** (או שנו את `TEACHER_INITIAL_PASSWORD` **לפני** ה-seed הראשון). ה-seed לא משנה סיסמה של מורה שכבר קיימת.
* הסיסמה נשמרת כ-hash (argon2); אין דרך לשחזר אותה – רק לאפס דרך seed/DB.

## 8. בדיקות תקינות (health)

| מה | פקודה / כתובת | תוצאה צפויה |
|---|---|---|
| API דרך nginx | `curl -s https://<DOMAIN>/api/health` | `{"status":"ok","db":"ok","uptime":…}` |
| הפניה HTTP→HTTPS | `curl -I http://<DOMAIN>/` | `301` ל-`https://` |
| סטטוס קונטיינרים | `docker compose -f … -f … ps` | כל השירותים `running (healthy)` |
| WebSocket | `curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGVzdA==" https://<DOMAIN>/socket.io/?EIO=4&transport=websocket` | `101 Switching Protocols` |
| TLS | `https://www.ssllabs.com/ssltest/analyze.html?d=<DOMAIN>` | A / A+ |

Healthchecks מובנים: `server` (`/api/health`), `web` (`/healthz`), `nginx` (`/nginx-health`), `db` (`pg_isready`). `docker inspect --format '{{.State.Health.Status}}' <container>` מציג את המצב.

## 9. לוגים

```bash
C="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
$C logs -f --tail=100 server      # NestJS (pino, JSON)
$C logs -f --tail=100 nginx       # access/error log
$C logs -f backup                 # הצלחת/כשל גיבויים
$C logs certbot                   # חידוש תעודות
$C logs -f                        # הכול
```

* הלוגים מוגבלים ל-10MB × 5 קבצים לכל קונטיינר (`json-file`, מוגדר ב-compose) – לא ימלאו את הדיסק.
* לוגי השרת הם JSON (pino). לקריאה נוחה: `$C logs --no-log-prefix server | npx pino-pretty` (אם Node מותקן במארח) או `jq`.
* `LOG_LEVEL=debug` ב-`.env` + `$C up -d server` – לאבחון בלבד.

## 10. עדכון גרסה

```bash
cd /opt/opposites
scripts/deploy.sh
```

הסקריפט: `git pull --ff-only` → גיבוי DB (`scripts/backup-db.sh`) → `docker compose build --pull server web` → `up -d --remove-orphans` → המתנה ל-health → `prisma migrate deploy` (אימות) → `docker image prune -f`.

* זמן השבתה: כמה שניות (בזמן החלפת קונטיינר השרת). שחקנים מחוברים יתחברו מחדש אוטומטית (Socket.IO reconnect + שחזור סשן ב-`GET /api/player/session`), אבל **עדיף לעדכן מחוץ לשעות משחק**.
* חזרה לאחור (rollback): `git checkout <tag/commit קודם>` ואז `scripts/deploy.sh --no-pull`. אם המיגרציה החדשה שינתה סכמה – לשחזר גם את הגיבוי שנוצר לפני העדכון (§11).
* `.env` חדש/משתנה שהשתנה → `$C up -d` מספיק (ללא build). שינוי ב-`VITE_API_URL` דורש `build` של `web`.

## 11. גיבוי ושחזור

### אוטומטי – sidecar `backup`

שירות `backup` ב-`docker-compose.prod.yml` מריץ `pg_dump -Fc` כל 24 שעות (מיד בעלייה ואז כל `BACKUP_INTERVAL_SECONDS`) ל-volume `backups`, ומוחק קבצים ישנים מ-`BACKUP_KEEP_DAYS` (14) ימים.

```bash
$C exec backup ls -lh /backups                 # רשימת הגיבויים
$C cp backup:/backups ./backups                # העתקה למארח
```

### ידני / cron במארח – `scripts/backup-db.sh`

```bash
scripts/backup-db.sh                           # → ./backups/opposites-YYYYmmdd-HHMMSS.dump
BACKUP_DIR=/var/backups/opposites scripts/backup-db.sh --sql   # גם .sql.gz
```

cron יומי (`crontab -e` של המשתמש שמריץ docker):

```
30 3 * * * /opt/opposites/scripts/backup-db.sh >> /var/log/opposites-backup.log 2>&1
```

**חשוב**: גיבוי שנשאר על אותו שרת אינו גיבוי. העתיקו את התיקייה החוצה (rclone / scp / S3) – למשל `rclone sync /var/backups/opposites remote:opposites-backups` כשורה נוספת ב-cron. יש לגבות גם את `.env` (מכיל את הסודות – לאחסן מוצפן) ואת `infrastructure/certbot/conf` (לא קריטי – ניתן להנפיק תעודה מחדש).

### שחזור – `scripts/restore-db.sh`

```bash
scripts/restore-db.sh backups/opposites-20250101-033000.dump
```

הסקריפט עוצר את השרת, מנתק חיבורים, מריץ `pg_restore --clean --if-exists` (דורס את הנתונים הקיימים!), ומעלה את השרת (שמריץ `migrate deploy` ליישור מיגרציות אם הגיבוי מגרסה ישנה). תומך גם ב-`.sql` / `.sql.gz`.

תרגול שחזור פעם בכמה חודשים הוא חלק מהגיבוי.

## 12. חידוש תעודה

* תעודות Let's Encrypt תקפות ל-90 יום. שירות `certbot` מריץ `certbot renew` כל 12 שעות ומחדש אוטומטית כשנותרו פחות מ-30 יום. `nginx` עושה `reload` כל 6 שעות וטוען את התעודה החדשה.
* בדיקה: `$C run --rm --entrypoint certbot certbot certificates`
* חידוש ידני מיידי: `$C run --rm --entrypoint certbot certbot renew --webroot -w /var/www/certbot && $C exec nginx nginx -s reload`
* בדיקת חידוש בלי להנפיק: `… certbot renew --dry-run`.
* אם ה-email ב-`.env` אמיתי, Let's Encrypt ישלח התראה 20 יום לפני פקיעה אם החידוש נכשל.

## 13. פתרון תקלות

### WebSocket לא מתחבר (המשחק "תקוע" בהמתנה, הלוח לא מתעדכן)

* בדפדפן (F12 → Network → WS): הבקשה ל-`/socket.io/?EIO=4&transport=websocket` צריכה לקבל `101`. אם מתקבל `400/502` – nginx לא מעביר את ה-upgrade.
* ודאו ש-`location /socket.io/` ב-template כולל `include /etc/nginx/snippets/websocket-params.conf` (Upgrade/Connection headers) ושה-`map $http_upgrade $connection_upgrade` קיים ב-`nginx.conf`.
* proxy/CDN חיצוני (Cloudflare) חייב לתמוך ב-WebSocket (ב-Cloudflare מופעל כברירת מחדל).
* Socket.IO נופל ל-polling אם WS נכשל – המשחק יעבוד אבל לאט. בדקו גם `proxy_read_timeout` (3600s בקובץ).
* רשת בית ספר שחוסמת WebSocket: polling אמור לעבוד דרך HTTPS רגיל; בדקו שהרשת לא חוסמת את הדומיין.

### שגיאות CORS בקונסולת הדפדפן

* בפרודקשן ה-SPA וה-API באותו origin (nginx מנתב `/api`), ולכן CORS לא אמור להופיע כלל. אם מופיע: ודאו ש-`VITE_API_URL` בבנייה הוא `/api` (יחסי) ולא כתובת מלאה אחרת.
* `CORS_ORIGINS` ב-`.env` חייב לכלול את ה-origin המדויק (`https://opposites.example.com`, בלי `/` בסוף). אחרי שינוי: `$C up -d server`.
* Cookie של מורה לא נשמר → בדקו שהאתר נטען ב-HTTPS (cookie `Secure`) ושהבקשה כוללת `X-Requested-With: XMLHttpRequest` (CSRF guard, ראו `docs/API.md`).

### `429 Too Many Requests` בהצטרפות לחדר

* nginx מגביל `/api/rooms/join` ל-60 בקשות לדקה לכל IP עם burst 40. כיתה שלמה מאחורי NAT אחד נספרת כ-IP אחד – אם יש כמה כיתות במקביל באותו בית ספר, הגדילו `rate`/`burst` ב-`nginx.conf` וב-template (`$C up -d --force-recreate nginx` – או `$C exec nginx nginx -s reload`).
* `/api/auth/login`: 10 לדקה, burst 5 – הגנה מפני brute-force.

### nginx לא עולה / `host not found in upstream`

* `$C logs nginx`. אם `cannot load certificate` – אין תעודה: הריצו `scripts/init-letsencrypt.sh` (או זמנית `NGINX_TEMPLATE=app.http-only.conf.template $C up -d --force-recreate nginx`).
* `${DOMAIN}` לא הוחלף: ודאו ש-`DOMAIN` מוגדר ב-`.env` (ה-compose נכשל בלי זה).
* שינוי בקבצי nginx: `$C exec nginx nginx -t` לבדיקת תחביר ואז `$C exec nginx nginx -s reload`. שינוי ב-template דורש `--force-recreate` (ה-envsubst רץ רק בעלייה).

### השרת במצב `unhealthy` / מופעל מחדש בלולאה

* `$C logs --tail=200 server`. סיבות נפוצות: `DATABASE_URL` לא תקין (סיסמה עם תווים מיוחדים), `JWT_SECRET` קצר מדי, מיגרציה שנכשלה.
* מיגרציה שנכשלה באמצע: `$C exec server prisma migrate status`, ולפי הצורך `prisma migrate resolve --rolled-back <name>` (ראו תיעוד Prisma) או שחזור מגיבוי.
* `prisma migrate deploy` ממתין ל-DB עד 60 שניות (`MIGRATE_RETRIES`); אם ה-DB איטי לעלות (דיסק איטי) – הגדילו.

### הנפקת תעודה נכשלת

* `dig +short <DOMAIN>` חייב להחזיר את ה-IP של השרת; `curl http://<DOMAIN>/nginx-health` מהמחשב שלכם חייב להחזיר `ok`.
* פורט 80 חסום (ufw / חומת אש של הספק / Cloudflare proxy בזמן ההנפקה).
* "too many certificates / rate limit" – השתמשו ב-`STAGING=1` לניסיונות, והמתינו שעה.

### מקום בדיסק

* `docker system df` ; `docker image prune -a -f` (אימג'ים ישנים) ; `docker builder prune -f` (cache של BuildKit).
* גיבויים ישנים נמחקים אוטומטית (14 יום); לוגים מוגבלים ל-50MB לקונטיינר.

## 14. אבטחה

* **ה-DB אינו חשוף** – אין `ports:` ל-`db`; הרשת `backend` היא `internal`. לגישה ידנית: `$C exec db psql -U $POSTGRES_USER -d $POSTGRES_DB`.
* **סודות רק ב-`.env`** (הרשאות `600`, לא ב-git, לא באימג'ים – `.dockerignore` מחריג `.env*`). החלפת סוד: לערוך `.env` ואז `$C up -d`. החלפת `JWT_SECRET`/`COOKIE_SECRET` מנתקת את כל המורים המחוברים.
* **הקונטיינרים רצים ללא root** (השרת כמשתמש `node`); nginx worker כמשתמש `nginx`.
* **TLS**: TLS 1.2/1.3 בלבד, HSTS לשנה (`includeSubDomains` – ודאו שכל תתי-הדומיינים שלכם ב-HTTPS, או הסירו).
* **כותרות אבטחה**: `helmet` ב-API, `X-Frame-Options`/`nosniff`/`Referrer-Policy` ב-SPA. CSP לא מוגדר (אפשר להוסיף ב-`infrastructure/nginx/snippets/security-headers.conf` אחרי בדיקה).
* **Rate limiting** ב-nginx (join/login/API) בנוסף ל-`@nestjs/throttler` בשרת. ה-NestJS צריך `trust proxy` כדי לראות את ה-IP האמיתי (`X-Forwarded-For`) – אחרת כל הבקשות ייראו כמגיעות מ-nginx.
* **עדכונים**: `scripts/deploy.sh` מריץ `build --pull` (אימג'י בסיס עדכניים). מומלץ לעדכן את ה-VPS (`apt upgrade`) חודשית ולהפעיל מחדש אם יש kernel חדש.
* **SSH**: מפתחות בלבד (`PasswordAuthentication no`), `fail2ban`.
* **פרטיות תלמידים**: המערכת שומרת שמות תצוגה וניקוד בלבד; מחיקת חדר (`DELETE /api/games/:id`) מוחקת את נתוני התלמידים. גיבויים מכילים את הנתונים – אחסנו אותם מוצפנים ומחקו לפי מדיניות בית הספר.

## 15. סטאק מקומי מלא (ללא TLS)

לבדיקה של האימג'ים כפי שהם בפרודקשן, במחשב פיתוח (או ב-VPS לפני DNS):

```bash
cp .env.example .env            # ולשנות סיסמאות
docker compose up -d --build    # db + server + web
# http://localhost:8080  – ה-web מנתב /api ו-/socket.io לשרת (אותו origin, ללא CORS)
RUN_SEED=true docker compose up -d server     # seed בפעם הראשונה
docker compose logs -f server
docker compose down             # להשאיר את הנתונים
docker compose down -v          # למחוק גם את ה-volume של ה-DB
```

לפיתוח יומיומי (hot reload) עדיף להריץ `pnpm dev` במארח ורק את ה-DB ב-Docker: `scripts/dev-db.sh` (ראו [`docs/WINDOWS_DEV.md`](WINDOWS_DEV.md) – ההוראות תקפות גם ל-Linux/macOS).

## הערה: עדכון מאגר התוכן אחרי שדרוג
שדרוגים שמוסיפים סוגי שאלות (למשל "תמונה מול תמונה – ללא קריאה") דורשים **הרצת seed מחדש** אחרי `prisma migrate deploy`, כדי שזוגות ההפכים הקיימים יקבלו את סוגי השאלות החדשים ב־`supportedTypes`. ה־seed אידמפוטנטי (upsert לפי slug) אך הוא מעדכן את שדות הזוגות לפי קובץ התוכן – אם ערכתם זוגות ידנית בממשק המורה, גבו את מסד הנתונים לפני ההרצה. הרצה:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm -e RUN_SEED=true server true
```
או באופן ידני: `pnpm --filter @oc/server prisma:seed`.
