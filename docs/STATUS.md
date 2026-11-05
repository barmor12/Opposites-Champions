# סטטוס פרויקט – אלופי ההפכים

עדכון אחרון: 2026-11-05 · ענף: `claude/modest-euler-a0m49c`

## מה הושלם (לפי שלבי האפיון)

| שלב | סטטוס | פירוט |
|---|---|---|
| 1. Foundation | ✅ | Monorepo pnpm (`apps/web`, `apps/server`, `packages/shared`, `packages/content`, `tests/e2e`), TypeScript strict, Prisma schema (16 טבלאות, UUID, FK, אינדקסים, unique לתשובות כפולות, soft delete), 2 migrations, seed אידמפוטנטי, Docker/Nginx, מערכת עיצוב |
| 2. Core Game | ✅ | NestJS: auth מורה (JWT cookie HttpOnly/SameSite + CSRF header), חדרים עם קוד 6 ספרות לא רציף, הצטרפות תלמיד (session token מגובב, מניעת שמות כפולים, סינון שמות), מחולל שאלות, ניקוד בשרת בלבד (`calculateScore` מהאפיון), תוצאות |
| 3. Realtime | ✅ | Socket.IO gateway עם אימות ב־middleware, חדרי `room:/teacher:/participant:`, טיימרים בשרת עם timestamps + clock-sync, התחברות חוזרת ללא איבוד ניקוד, דירוג בזמן אמת (throttled), הכרעת שוויון לפי האפיון, 6 הישגים |
| 4. סוגי משחקים | ✅ | בחירת ההפך, בחירת תמונה, התאמת זוגות (הפיכת קלפים + בונוס), השלמת משפטים, אתגר האוצר (5 ברצף + בונוס 150), **ובנוסף: "תמונה מול תמונה – ללא קריאה"** (רמה קלה, הקראה קולית בעברית דרך speechSynthesis) |
| 5. ממשק מורה | ✅ | `/teacher`: התחברות, לוח בקרה (סטטיסטיקות, חדרים), יצירת משחק (כל ההגדרות + פריסט "רמה קלה – תמונות בלבד"), חדר חי (קוד ענק, QR, שליטה: התחל/השהה/המשך/הבא/סיים/סבב חדש/סגור הצטרפות/הסרת תלמיד, דירוג חי), דוחות (ממוצע, דיוק, שאלות קשות, התפלגות) + ייצוא CSV/XLSX, ניהול מאגר הפכים |
| 6. Visual Polish | ✅ | 227 זוגות הפכים ב־10 קטגוריות, 155 איורי SVG מקוריים בסגנון 3D (61 זוגות × 2, 16 אווטארים, 4 דמויות, 13 UI), ממשק פרימיום (כפתורי 3D, רקע קולנועי, פודיום 3D, קלפי flip), צלילים מקוריים ב־WebAudio, רספונסיביות 360→1920, RTL, נגישות (focus traps, ניגודיות AA, אזורי לחיצה ≥44px, live regions, reduced-motion) |
| 7. Production | ✅ | Dockerfiles multi-stage, Compose dev/prod (DB לא חשוף, volumes, healthchecks, restart, גיבוי יומי), Nginx reverse proxy + WebSocket + Let's Encrypt + rate limits, סקריפטים (deploy/backup/restore/init-letsencrypt), הקשחת אבטחה (10 ממצאים תוקנו – ראו `SECURITY.md`), CI (GitHub Actions), README + `DEPLOYMENT.md` + `WINDOWS_DEV.md` |

## תוצאות בדיקות (הרצה מקומית, PostgreSQL 16)

| חבילה | פקודה | תוצאה |
|---|---|---|
| `@oc/shared` | `vitest` | 21 ✓ |
| `@oc/content` | `vitest` | 22 ✓ (≥210 זוגות, ייחודיות, משפטים, מניפסט) |
| `@oc/server` | `vitest` (unit) | 98 ✓ |
| `@oc/server` | `vitest` (integration, DB אמיתי) | 35 ✓ – כולל זרימה מלאה self/teacher-paced, הישגים, ייצוא, אבטחה, ו־**40 תלמידים במקביל ב־Socket.IO** |
| `@oc/web` | `vitest` + Testing Library | 77 ✓ |
| `@oc/e2e` | Playwright (desktop) | ראו סעיף E2E להלן |
| lint / typecheck / build | `pnpm lint && pnpm typecheck && pnpm build` | ראו סעיף אימות להלן |

### E2E (Playwright)
תרחישים: מורה יוצרת חדר → 2 תלמידים מצטרפים (כולל חסימת שם כפול) → התחלה → משחק מלא במקביל (כולל רענון דפדפן באמצע) → מדליות ודירוג → דוח מורה; קוד חדר שגוי; RTL + טעינת תמונות; משחק "תמונות בלבד".
תוצאה אחרונה: **4/4 עברו** (`npx playwright test --project=desktop`, 2.4 דקות; דפדפן Chromium מותקן מראש דרך `PW_CHROMIUM_PATH`).

### אימות מלא (lint/typecheck/test/build)
הרצה אחרונה (2026-11-05, Node 22, pnpm 10, PostgreSQL 16 מקומי):

| שלב | פקודה | תוצאה |
|---|---|---|
| Lint | `pnpm lint` (ESLint בכל החבילות) | ✅ 0 שגיאות, 0 אזהרות |
| Typecheck | `pnpm typecheck` (`tsc --noEmit`, strict) | ✅ 5/5 חבילות |
| Unit | `pnpm test` (vitest; לא כולל E2E) | ✅ 218/218 – shared 21, content 22, web 77, server 98 |
| Integration | `pnpm --filter @oc/server test:int` | ✅ 35/35 |
| E2E | `pnpm test:e2e` (`--project=desktop`, אחרי `pnpm build`) | ✅ 4/4 |
| Build | `pnpm build` (Vite + Nest + fix-aliases) | ✅ |

הערה: `pnpm test` מריץ רק בדיקות יחידה; E2E מורץ בנפרד ב־`pnpm test:e2e` כי הוא דורש שרת בנוי ומסד נתונים זמין.

## מגבלות ידועות / מה חסר
- **Docker daemon לא זמין בסביבת הפיתוח** – `docker compose config` ו־Dockerfiles נבדקו בסקירה ובווידוא תחביר בלבד; יש להריץ `docker compose up --build` בפועל ב־VPS/מקומית לפני פריסה ראשונה.
- אין בדיקה של `nginx -t` בסביבה; קובצי ה־Nginx נסקרו ידנית.
- **אחרי שדרוג שמוסיף סוגי שאלות יש להריץ seed מחדש** (`RUN_SEED=true` או `pnpm db:seed`) – ראו `DEPLOYMENT.md`.
- הקראה קולית (TTS) תלויה בקול עברי שמותקן בדפדפן/מערכת ההפעלה; כשאין – הכפתור מוסתר.
- `GET /api/games/:id/results` מחזיר סבב אחד; ממשק המורה צובר רשימת סבבים מהתוצאות שנצפו (אין endpoint לרשימת סבבים).
- כפתורי ה־UI המשותפים (`Button`) עודכנו לניגודיות AA; מומלץ לבצע ביקורת נגישות ידנית נוספת עם קורא מסך בעברית (NVDA/VoiceOver).

## הרצה מהירה
```bash
pnpm install
cp .env.example apps/server/.env   # לערוך DATABASE_URL + סודות
pnpm --filter @oc/server prisma:generate && pnpm --filter @oc/server prisma:migrate && pnpm db:seed
pnpm dev     # web: http://localhost:5173 · api: http://localhost:3000/api · teacher: /teacher
```
