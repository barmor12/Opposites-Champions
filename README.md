# 🌈 אלופי ההפכים 🏆 – Opposites Champions

משחק לימודי אינטראקטיבי בעברית לתרגול מילים מנוגדות, המיועד לתלמידי כיתה ג׳. התלמידים מצטרפים מהמחשב/הטאבלט שלהם עם קוד משחק, משחקים בחמישה סוגי שאלות (בחירת ההפך, בחירת תמונה, התאמת זוגות, השלמת משפטים ואתגר האוצר), והמורה מנהלת את התחרות ורואה דירוג בזמן אמת, מדליות ודוחות.

## טכנולוגיות
- **Frontend**: React 19 + TypeScript, Vite, Tailwind CSS 4, Motion, Lucide, React Router, Zustand, Socket.IO Client – RTL מלא, Responsive.
- **Backend**: NestJS 11 + TypeScript, Socket.IO, Prisma 6, PostgreSQL 16, REST API, JWT cookie auth למורה, ולידציה DTO, לוגים (pino).
- **Infra**: Docker, Docker Compose, Nginx (reverse proxy + WebSocket + HTTPS/Let's Encrypt), Health checks, Volumes, גיבויים.
- **Monorepo** (pnpm workspaces): `apps/web`, `apps/server`, `packages/shared` (חוזים משותפים), `packages/content` (מאגר ההפכים – מופרד מקוד המשחק), `tests/e2e`.

## מבנה הפרויקט
```
apps/web          – אפליקציית התלמיד + ממשק המורה (/teacher)
apps/server       – שרת NestJS, Prisma schema, migrations, seed
packages/shared   – טיפוסים, אירועי Socket, ניקוד, דירוג, מכונת מצבים
packages/content  – 200+ זוגות הפכים, משפטים, Asset manifest
infrastructure    – Docker, Nginx
tests/e2e         – בדיקות Playwright
docs              – API, פריסה, פיתוח ב-Windows, סטטוס
```

## הרצה מקומית (Linux / macOS)
דרישות: Node 22+, pnpm 10 (`corepack enable`), PostgreSQL 16 (מקומי או דרך Docker: `scripts/dev-db.sh`).

```bash
pnpm install
cp .env.example apps/server/.env   # ערכו DATABASE_URL, JWT_SECRET, COOKIE_SECRET, TEACHER_INITIAL_*
pnpm --filter @oc/server prisma:generate
pnpm --filter @oc/server prisma:migrate:dev
pnpm db:seed
pnpm dev
```
- תלמידים: http://localhost:5173
- מורה: http://localhost:5173/teacher (התחברות עם `TEACHER_INITIAL_EMAIL` / `TEACHER_INITIAL_PASSWORD`)
- API: http://localhost:3000/api, בריאות: http://localhost:3000/api/health

הוראות מפורטות ל־Windows: [docs/WINDOWS_DEV.md](docs/WINDOWS_DEV.md).

## הרצה עם Docker Compose
```bash
cp .env.example .env    # ערכו סודות
docker compose up -d --build
```
האתר זמין ב־http://localhost:8080 (ה־API ו־Socket.IO מוגשים דרך אותו origin).

## פריסה על VPS עם דומיין ו־HTTPS
ראו [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) – כולל DNS, Let's Encrypt, גיבויים, עדכונים ופתרון תקלות.
```bash
cp .env.example .env && nano .env        # DOMAIN, סודות, סיסמת מורה
./scripts/init-letsencrypt.sh            # הפקת תעודה ראשונית
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## פקודות שימושיות
| פקודה | תיאור |
|---|---|
| `pnpm build` | build לכל החבילות |
| `pnpm lint` / `pnpm typecheck` | בדיקות סטטיות |
| `pnpm test` | Unit + Integration (דורש DB) |
| `pnpm test:e2e` | Playwright (דורש build של השרת + seed) |
| `pnpm db:migrate` | `prisma migrate deploy` |
| `pnpm db:seed` | טעינת 200+ זוגות, מדיה, הישגים ומורה ראשונית |

## מסמכים
- [docs/API.md](docs/API.md) – חוזה REST + Socket.IO
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) – פריסה ב־VPS
- [docs/WINDOWS_DEV.md](docs/WINDOWS_DEV.md) – סביבת פיתוח ב־Windows
- [docs/STATUS.md](docs/STATUS.md) – מה הושלם, תוצאות בדיקות ומה חסר

## פרטיות ואבטחה
- לא נאסף מידע מזהה על תלמידים – שם תצוגה ואווטאר בלבד; השם אינו מזהה אבטחה (לכל משתתף מזהה ייחודי ו־session token).
- הניקוד מחושב בשרת בלבד; תשובה אחת לכל שאלה (Unique Constraint); אימות שייכות לחדר בכל פעולה.
- מחיקת חדר (`DELETE /api/games/:id`) מוחקת את כל נתוני התלמידים של החדר. מומלץ למחוק חדרים בסיום שנת הלימודים.
- אין סודות ב־Git; כל ההגדרות ב־`.env`.
