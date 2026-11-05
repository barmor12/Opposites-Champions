# סביבת פיתוח ב-Windows – אלופי ההפכים

מדריך להקמת סביבת פיתוח מקומית ב-Windows 10/11. (ההוראות תקפות ברובן גם ל-macOS/Linux – שם רק מדלגים על החלקים הייחודיים ל-Windows.)

## תוכן

1. [מה מתקינים](#1-מה-מתקינים)
2. [Node 22 ו-pnpm](#2-node-22-ו-pnpm)
3. [Git – סופי שורה](#3-git--סופי-שורה)
4. [PostgreSQL: Docker Desktop או התקנה מקומית](#4-postgresql-docker-desktop-או-התקנה-מקומית)
5. [קבלת הקוד, `.env`, התקנת תלויות](#5-קבלת-הקוד-env-התקנת-תלויות)
6. [מסד נתונים: מיגרציות ו-seed](#6-מסד-נתונים-מיגרציות-ו-seed)
7. [הרצה](#7-הרצה)
8. [פורטים](#8-פורטים)
9. [פקודות שימושיות](#9-פקודות-שימושיות)
10. [בעיות נפוצות](#10-בעיות-נפוצות)
11. [בדיקת הסטאק המלא ב-Docker](#11-בדיקת-הסטאק-המלא-ב-docker)

---

## 1. מה מתקינים

| כלי | למה | איך |
|---|---|---|
| **Git for Windows** | קוד + Git Bash (להרצת הסקריפטים ב-`scripts/`) | https://git-scm.com/download/win |
| **Node.js 22 LTS** | הרצת השרת/הלקוח | nvm-windows (מומלץ) או התקנה רגילה – §2 |
| **pnpm 10.28** | מנהל החבילות של ה-monorepo | דרך corepack – §2 |
| **Docker Desktop** *או* **PostgreSQL 16** | מסד הנתונים | §4 |
| **VS Code** (מומלץ) | עם ההרחבות: ESLint, Prettier, Prisma, Tailwind CSS IntelliSense | https://code.visualstudio.com |
| **Windows Terminal** (מומלץ) | טרמינל נוח (PowerShell / Git Bash) | Microsoft Store |

> אפשרות חלופית: **WSL2** (Ubuntu) – אז הסביבה היא לינוקס לכל דבר, ו-Docker Desktop משתלב איתה. אם עובדים ב-WSL, שמרו את הריפו **בתוך** מערכת הקבצים של WSL (`~/projects/...`) ולא ב-`/mnt/c/...` (איטי מאוד עם node_modules).

## 2. Node 22 ו-pnpm

### אפשרות א – nvm-windows (מומלץ, מאפשר כמה גרסאות Node)

1. התקינו מ-https://github.com/coreybutler/nvm-windows/releases (`nvm-setup.exe`). אם יש Node מותקן – הסירו אותו קודם.
2. ב-PowerShell **כמנהל**:

   ```powershell
   nvm install 22
   nvm use 22
   node --version      # v22.x
   ```

### אפשרות ב – מתקין רשמי

https://nodejs.org → "22 LTS" → Next-Next-Finish (אפשר לדלג על "Tools for Native Modules" – לא נדרש, ל-argon2 יש binary מוכן ל-Windows).

### pnpm דרך corepack

הפרויקט מצמיד `pnpm@10.28.0` ב-`package.json` (`packageManager`). corepack מגיע עם Node 22:

```powershell
corepack enable                 # ייתכן שדורש PowerShell כמנהל (יוצר shims בתיקיית Node)
corepack prepare pnpm@10.28.0 --activate
pnpm --version                  # 10.28.0
```

אם `corepack` לא עובד (חסימות רשת / גרסת Node ישנה): `npm install -g pnpm@10.28.0`.

**PowerShell – Execution Policy**: אם מופיע `pnpm.ps1 cannot be loaded because running scripts is disabled`:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

(או פשוט לעבוד ב-Git Bash / cmd, שם זה לא רלוונטי.)

## 3. Git – סופי שורה

קבצי shell (`scripts/*.sh`, `apps/server/docker-entrypoint.sh`) חייבים להישאר עם **LF**. ב-Windows, Git עלול להמיר ל-CRLF ולשבור אותם (`/bin/sh^M: bad interpreter`) ואת ESLint/Prettier.

לפני ה-clone (פעם אחת, גלובלית):

```powershell
git config --global core.autocrlf false
git config --global core.longpaths true      # נתיבים ארוכים ב-node_modules
```

אם כבר עשיתם clone עם המרה: `git config core.autocrlf false` ואז `git rm -r --cached . && git reset --hard`.

ב-VS Code: בפינה הימנית-תחתונה "CRLF" → לבחור "LF", או בהגדרות `"files.eol": "\n"`.

## 4. PostgreSQL: Docker Desktop או התקנה מקומית

### אפשרות א – Docker Desktop (מומלץ)

1. התקינו Docker Desktop (https://www.docker.com/products/docker-desktop/) עם backend של **WSL2** (ברירת המחדל). ייתכן שתידרש הפעלת וירטואליזציה ב-BIOS והתקנת WSL (`wsl --install` ב-PowerShell כמנהל + הפעלה מחדש).
2. הריצו את ה-DB לפיתוח (קונטיינר יחיד, הנתונים נשמרים ב-volume):

   ```bash
   # Git Bash (או WSL)
   bash scripts/dev-db.sh            # start – postgres:16-alpine על 127.0.0.1:5432
   bash scripts/dev-db.sh stop       # עצירה
   bash scripts/dev-db.sh reset      # מחיקה והתחלה מחדש
   ```

   מקבילה ב-PowerShell (ללא הסקריפט):

   ```powershell
   docker run -d --name opposites-dev-db `
     -e POSTGRES_USER=opposites -e POSTGRES_PASSWORD=change-me-strong-password -e POSTGRES_DB=opposites `
     -p 127.0.0.1:5432:5432 -v opposites-dev-pgdata:/var/lib/postgresql/data `
     --restart unless-stopped postgres:16-alpine
   ```

   הערכים צריכים להתאים ל-`DATABASE_URL` ב-`.env` (ברירת המחדל של `.env.example` כבר תואמת).

### אפשרות ב – PostgreSQL מותקן ב-Windows

1. מתקין רשמי: https://www.postgresql.org/download/windows/ (גרסה 16). זכרו את סיסמת `postgres`. אפשר לדלג על Stack Builder.
2. פתחו `psql` (או pgAdmin) וצרו משתמש ו-DB:

   ```sql
   CREATE USER opposites WITH PASSWORD 'change-me-strong-password';
   CREATE DATABASE opposites OWNER opposites;
   ```

3. `DATABASE_URL` ב-`.env`: `postgresql://opposites:change-me-strong-password@localhost:5432/opposites?schema=public`.

ממשק גרפי נוח: pgAdmin (מגיע עם המתקין), DBeaver, או ההרחבה "PostgreSQL" ב-VS Code. גם `pnpm --filter @oc/server exec prisma studio` (http://localhost:5555).

## 5. קבלת הקוד, `.env`, התקנת תלויות

```powershell
git clone <REPO_URL> opposites-champions
cd opposites-champions
Copy-Item .env.example .env        # cmd: copy .env.example .env  | bash: cp .env.example .env
pnpm install
```

* ערכו את `.env` אם שיניתם סיסמה/פורט של ה-DB. לפיתוח, ברירות המחדל (`APP_URL=http://localhost:5173`, `CORS_ORIGINS=http://localhost:5173`, `DATABASE_URL=...@localhost:5432/...`) מתאימות.
* `pnpm install` מתקין את כל ה-workspace (`apps/*`, `packages/*`, `tests/*`) ומריץ `prisma generate` ו-build של `argon2` (יש binary מוכן – לא נדרש Visual Studio).
* `tests/e2e` משתמש ב-Playwright; דפדפנים מורידים בנפרד: `pnpm --filter @oc/e2e exec playwright install` (רק אם מריצים E2E).

## 6. מסד נתונים: מיגרציות ו-seed

```powershell
pnpm --filter @oc/server prisma:migrate:dev     # prisma migrate dev – יוצר/מריץ מיגרציות (פיתוח)
pnpm db:seed                                    # tsx prisma/seed.ts – מורה ראשונית + צמדי מילים
```

* `pnpm db:migrate` מריץ `prisma migrate deploy` – מתאים ל-CI/פרודקשן (לא יוצר מיגרציות חדשות). בפיתוח, אחרי שינוי ב-`schema.prisma`, השתמשו ב-`prisma:migrate:dev` (ייצור קובץ מיגרציה ב-`apps/server/prisma/migrations/`).
* אחרי שינוי סכמה: `pnpm --filter @oc/server prisma:generate` (migrate dev עושה זאת אוטומטית).
* המורה הראשונית נוצרת לפי `TEACHER_INITIAL_EMAIL` / `TEACHER_INITIAL_PASSWORD` ב-`.env`.
* איפוס מלא של ה-DB בפיתוח: `pnpm --filter @oc/server exec prisma migrate reset` (מוחק הכול, מריץ מיגרציות ו-seed).

## 7. הרצה

```powershell
pnpm dev          # מריץ במקביל: apps/server (nest start --watch) + apps/web (vite --host)
```

* לקוח: http://localhost:5173 (Vite, hot reload). השרת: http://localhost:3000/api (בדיקה: http://localhost:3000/api/health).
* Vite מוגדר ל-proxy של `/api` ו-`/socket.io` לשרת – אם לא, הלקוח פונה ל-`VITE_API_URL`. בפיתוח לרוב אין צורך ב-`VITE_*` נוספים.
* הרצה נפרדת: `pnpm --filter @oc/server dev` / `pnpm --filter @oc/web dev`.
* בדיקה מטלפון באותה רשת Wi-Fi: `vite --host` מאזין על כל הכתובות – גשו ל-`http://<IP-של-המחשב>:5173`. ייתכן שחומת האש של Windows תשאל – לאשר ברשת "פרטית". (ה-API צריך לאפשר את ה-origin הזה ב-`CORS_ORIGINS` אם הלקוח פונה ישירות ל-3000.)

## 8. פורטים

| פורט | שירות |
|---|---|
| 5173 | Vite dev server (לקוח) |
| 3000 | NestJS API + Socket.IO (`/api`, `/socket.io`) |
| 5432 | PostgreSQL |
| 5555 | Prisma Studio (אופציונלי) |
| 8080 | ה-web בסטאק ה-Docker המלא (§11) |

פורט תפוס? `netstat -ano | findstr :3000` → `taskkill /PID <pid> /F`.

## 9. פקודות שימושיות

```powershell
pnpm lint             # ESLint בכל החבילות
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest (unit)
pnpm --filter @oc/server test:int     # בדיקות אינטגרציה (דורש DB)
pnpm test:e2e         # Playwright
pnpm build            # build של הכול
pnpm format           # Prettier
pnpm --filter @oc/server exec prisma studio   # עיון בנתונים
```

## 10. בעיות נפוצות

| תסמין | סיבה / פתרון |
|---|---|
| `pnpm.ps1 cannot be loaded… running scripts is disabled` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` (§2) או להשתמש ב-Git Bash. |
| `'pnpm' is not recognized` | `corepack enable` לא רץ / טרמינל לא נפתח מחדש אחרי ההתקנה. |
| `ERR_PNPM_UNSUPPORTED_ENGINE` / "Unsupported engine" | Node ישן מ-22 – `nvm use 22`. |
| `/bin/sh^M: bad interpreter` או ESLint מתלונן על `␍` | סופי שורה CRLF – §3 (`core.autocrlf false`, ולהמיר את הקבצים ל-LF). |
| `EPERM: operation not permitted, rename …node_modules…` | אנטי-וירוס/Windows Defender נועל קבצים. הוסיפו את תיקיית הפרויקט לחריגות, סגרו VS Code/טרמינלים אחרים, הריצו שוב. |
| `ENAMETOOLONG` / "Filename too long" | `git config --global core.longpaths true`; שמרו את הפרויקט בנתיב קצר (`C:\dev\oc`). |
| `P1001: Can't reach database server at localhost:5432` | ה-DB לא רץ (`bash scripts/dev-db.sh status` / Services → postgresql-x64-16) או סיסמה/פורט שגויים ב-`DATABASE_URL`. |
| `P1000: Authentication failed` | סיסמה שונה בין `.env` לבין ה-DB. ב-Docker: `bash scripts/dev-db.sh reset` יוצר DB חדש עם הערכים מ-`.env`. |
| `EADDRINUSE: address already in use :::3000` | תהליך ישן – `netstat -ano \| findstr :3000` ו-`taskkill /PID … /F`. |
| Docker Desktop: "WSL 2 installation is incomplete" | `wsl --install` ב-PowerShell כמנהל + הפעלה מחדש; להפעיל וירטואליזציה ב-BIOS. |
| `docker exec -it` ב-Git Bash: "the input device is not a TTY" | להקדים `winpty`: `winpty docker exec -it …` (או `winpty bash scripts/dev-db.sh psql`). |
| נתיבים משתבשים ב-Git Bash (`/c/...` הופך ל-`C:\...` בתוך docker) | הגדירו `MSYS_NO_PATHCONV=1` לפני הפקודה. |
| `argon2` נכשל ב-build עם שגיאות node-gyp | לרוב אין צורך ב-build (יש prebuilt). אם בכל זאת: התקינו "Visual Studio Build Tools" עם workload "Desktop development with C++" ו-Python 3. |
| עברית מוצגת כ-`????` בטרמינל | Windows Terminal + `chcp 65001`, או PowerShell 7. אינו משפיע על האפליקציה. |
| Hot reload של Vite לא עובד בתיקייה תחת `/mnt/c` ב-WSL | העבירו את הריפו לתוך מערכת הקבצים של WSL. |

## 11. בדיקת הסטאק המלא ב-Docker

כדי לבדוק את האימג'ים של הפרודקשן מקומית (ללא TLS):

```powershell
docker compose up -d --build      # db + server + web; האתר ב-http://localhost:8080
docker compose logs -f server
docker compose down               # (-v למחיקת הנתונים)
```

הסטאק הזה משתמש ב-`.env` (עם `DATABASE_URL` שמופנה אוטומטית ל-`db`). seed בפעם הראשונה: `$env:RUN_SEED="true"; docker compose up -d server` (PowerShell) או `RUN_SEED=true docker compose up -d server` (bash). פרטים נוספים ב-[`docs/DEPLOYMENT.md`](DEPLOYMENT.md).
