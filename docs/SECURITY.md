# אבטחה – אלופי ההפכים (שרת)

מסמך זה מתאר את מודל האיומים, הבקרות שמומשו בשרת (`apps/server`), מדיניות שמירת הנתונים ומחיקתם, ורשימת בדיקה לפריסה.
המשתמשים הם ילדים בכיתה ומורה; לכן העיקרון המנחה: **מינימום מידע אישי, אפס אמון בלקוח, הכול מחושב בשרת.**

## 1. מודל איומים

| שחקן | מה הוא יכול לנסות | הגנה עיקרית |
|---|---|---|
| תלמיד "ממציא" | לשלוח ניקוד/תשובה נכונה מהלקוח, לענות פעמיים, לענות על שאלה של חדר אחר, לקרוא את התשובה הנכונה לפני הזמן | ניקוד וזמן בשרת בלבד, unique constraint, בדיקת שייכות לסבב, `QuestionView` ללא `isCorrect` |
| משתמש אנונימי באינטרנט | לנחש קודי חדר (6 ספרות), להציף `join`/`login`, להציף WebSocket, לשלוח גוף ענק | Rate limiting (HTTP + socket + nginx), תפוגת חדר 24h, קודים לא רציפים, מגבלת גודל גוף 64KB / 16KB ל־socket |
| מורה אחרת (חשבון תקין) | לצפות/לנהל חדר של מורה אחרת, לייצא תוצאות | כל נתיב מורה עובר `roomForTeacher` (בעלות לפי `teacherId`) |
| אתר זדוני בדפדפן המורה | CSRF על פעולות משנות מצב | cookie `HttpOnly; SameSite=Lax; Secure` + כותרת `X-Requested-With` חובה |
| תלמיד שהוסר מהחדר | להמשיך לשחק עם ה־token הישן | `removedAt` נבדק בכל guard / handler, ניתוק socket מיידי |
| דליפת לוגים/גיבויים | שמות תלמידים, tokens, cookies בלוגים | רדקציה ב־pino, סריאליזציה מינימלית, מיסוך קוד חדר ב־URL |

## 2. בקרות שמומשו (עם הפניות לקוד)

### 2.1 הרשאות (AuthZ)
- **מורה**: `TeacherAuthGuard` (`src/auth/teacher-auth.guard.ts`) מאמת JWT מה־cookie, בודק שהמורה קיימת (`deletedAt: null`) ודורש `X-Requested-With: XMLHttpRequest` לכל בקשה שאינה GET/HEAD. כל פעולה על חדר עוברת `GamesService.roomForTeacher` (`src/games/games.service.ts`) – 404 אם לא קיים, 403 אם לא בבעלות המורה. דוחות/ייצוא (`src/reports/reports.controller.ts`) ו־`sessionId` נבדקים מול `roomId`.
- **תלמיד (HTTP)**: `PlayerAuthGuard` (`src/players/player-auth.guard.ts`) – token בכותרת `x-player-token`, נבדק תחבירית (`isSessionTokenFormat`) ואז לפי hash; משתתף שהוסר לא עובר.
- **תלמיד (socket)**: אימות ב־middleware של Socket.IO (`GameGateway.authenticate`, `src/websocket/game.gateway.ts`) לפני שהחיבור מאושר – אין מרוץ בין `connect` לבין handlers. כל handler משתמש רק ב־`socket.data.participantId` שנקבע בשרת.
- **חדר זר**: `ScoringService.submitAnswer` (`src/scoring/scoring.service.ts`) דורש שה־`sessionQuestionId` יהיה השאלה הנוכחית של המשתתף; מזהה של סבב אחר/לא קיים → 404 `QUESTION_NOT_FOUND` (לא חושפים קיום), מזהה מהסבב שלו שאינו הנוכחי → 400 `WRONG_QUESTION`. בדיקה: `src/security.int.test.ts`.
- **`teacher:join`**: בעלות על החדר + קיום המורה נבדקים בשרת.
- **הסרה/ביטול/תפוגה**: `loadContext` (משתתף שהוסר, חדר שנמחק/פג) + `assertActive` (סבב מבוטל/פג → `NOT_ACTIVE`).

### 2.2 שלמות הניקוד
- `elapsedMs = now − questionStartedAt(שרת)`, clamp ל־`[0, timeLimit]`, חסד רשת `ANSWER_GRACE_MS`; אחרי תום הזמן – 0 נקודות (`src/scoring/scoring.service.ts`).
- תשובה כפולה / replay של `answer:submit` → unique `(sessionQuestionId, participantId)` → 409 `ALREADY_ANSWERED`; `question:next` חוזר עם מזהה ישן לא מקדם.
- **אין שדות ניקוד מהלקוח**: HTTP – `ValidationPipe({ whitelist, forbidNonWhitelisted })` (`src/app.setup.ts`); socket – `src/websocket/socket-payloads.ts` (רשימה לבנה קשיחה: מפתחות לא מוכרים, מזהים שאינם UUID, `matches` > 16, קלפים > 32 תווים → `INVALID_PAYLOAD`). `mistakes` מהלקוח משמש ל־UX בלבד.
- `MATCH_PAIRS`: קלפים חייבים להשתייך לשאלה; זוגות כפולים מסוננים; הניקוד לפי ההתאמות בשרת (`QuestionsService.checkAnswer`).

### 2.3 דליפת מידע
- `QuestionsService.toQuestionView` – ללא `isCorrect`/זוגות נכונים; `correctInfo` נחשף רק ב־`question:ended` (teacher-paced, אחרי סגירה) או ב־`answer:result` (self-paced, לפי `showCorrectAnswers`).
- `GET /api/rooms/:code` → `toRoomPublicView` ללא שמות (`src/rooms/room-views.ts`).
- לוגים: `src/common/logging.ts` – רדקציה של cookie / authorization / `x-player-token` / set-cookie / body / query; סריאליזציה של `id, method, url` בלבד (ללא IP/headers); קוד חדר ב־URL ממוסך (`/api/rooms/:code`). קוד חדר אינו נרשם גם בלוג התנגשות.
- שגיאות: `HttpExceptionFilter` (`src/common/http-exception.filter.ts`) – רק הודעות בעברית חוזרות ללקוח; טקסט של ספריות/parser/DB מוחלף בהודעה גנרית; 5xx תמיד גנרי; שגיאות body-parser (413/400) ממופות ל־JSON עברי.
- `GET /api/health` מחזיר `status/db/uptime` בלבד.

### 2.4 אסימונים וקוקיז
- Session token: 32 בתים אקראיים (`randomBytes`) ב־base64url; נשמר **רק** כ־sha256 (`GameParticipant.sessionTokenHash`, unique) והחיפוש לפי hash (`src/players/player-token.ts`). גבולות אורך 32–128 ואלפבית base64url לפני כל גישה ל־DB.
- Cookie מורה `oc_teacher`: JWT HS256, 12 שעות, `HttpOnly`, `SameSite=Lax`, `Secure` בפרודקשן, `Path=/` (`src/auth/teacher-cookie.ts`). CSRF header נדרש גם ב־logout ובהסרת משתתף.
- `JWT_SECRET`/`COOKIE_SECRET`: בפרודקשן חובה ≥32 תווים ולא placeholder – השרת לא עולה אחרת (`src/config/app-config.ts`).

### 2.5 הגבלת קצב ומניעת ניצול
- HTTP (`@nestjs/throttler`, לפי IP): גלובלי 100/דקה; `POST /api/auth/login` 10/דקה; `POST /api/rooms/join` 60/דקה; `GET /api/rooms/:code` 60/דקה (`src/rooms/rooms.controller.ts`). nginx מגביל בנוסף (`infrastructure/nginx/nginx.conf`).
- **קודי חדר**: 6 ספרות, `randomInt`, ללא רצפים/חזרות (`isWeakCode`); חדר **פג תוקף אחרי 24 שעות** (`expiresAt`) – נאכף בגישה (`RoomsService.expireIfStale`) ובסריקה כל 10 דקות (`GamesService.sweepExpiredRooms`); חדר פג = `EXPIRED`, `joinOpen=false`, הסבב נסגר והטיימרים מנוקים. סבב חדש מאריך ב־24 שעות; חדר `EXPIRED/CANCELLED` לא ניתן לפתיחה מחדש.
- שם תצוגה: `validateDisplayName` (`packages/shared/src/nameFilter.ts`) בשרת – אורך 2–20, תווים מותרים, מסנן מילים; שם כפול בחדר נדחה; `MAX_PLAYERS_PER_ROOM` (60) נאכף.
- גודל גוף: 64KB ל־JSON/urlencoded (`BODY_LIMIT`, `src/app.setup.ts`; `main.ts` עם `bodyParser: false`); Socket.IO `maxHttpBufferSize` 16KB.
- Socket (`src/websocket/socket-rate-limiter.ts`, `game.gateway.ts`): 100 handshakes / 10 שניות לכל IP; אחרי 60 כשלי אימות בדקה – handshakes מאותו IP נדחים; 60 אירועי משחק / 10 שניות לכל socket (`RATE_LIMITED`). מפות המונים חסומות בגודל ומנוקות.

### 2.6 WebSocket
- CORS מ־`CORS_ORIGINS` (`src/websocket/cors.ts`); בפרודקשן ללא ערך → אף מקור; בפיתוח → `http://localhost:5173` בלבד (לעולם לא `*`).
- אימות לכל socket; handlers דוחים משתתף שהוסר/חדר מבוטל/פג; `teacher:join` מאמת בעלות.
- אין מפות בלתי חסומות: `TimerRegistry` מנוקה בסיום/ביטול/מחיקה/תפוגה; throttling של לוח התוצאות מתנקה אחרי 500ms; מגבילי הקצב חסומים ומנוקים ב־disconnect.
- `trust proxy`: `TRUST_PROXY` (ברירת מחדל 1 בפרודקשן מאחורי nginx, 0 אחרת) – מכתיב גם את זיהוי ה־IP של socket (`socketClientIp`). ערך גבוה מדי מאפשר זיוף IP ועקיפת הגבלות.

### 2.7 Helmet / כותרות
- `helmet()` עם ברירות מחדל (nosniff, frameguard, referrer-policy, CSP) ו־`crossOriginResourcePolicy: cross-origin` ל־API; `x-powered-by` מבוטל; HSTS מגיע מ־nginx (`proxy_hide_header` מונע כפילות).

## 3. נתונים – מה נשמר, כמה זמן, איך מוחקים

| נתון | טבלה | תוכן | שמירה |
|---|---|---|---|
| תלמיד | `Student` | שם תצוגה (שבחר התלמיד), אווטאר, זמן יצירה. **אין** שם משפחה, כיתה אמיתית, אימייל, IP או מזהה חיצוני | עד מחיקת החדר |
| משתתף | `GameParticipant` | hash של token, מצב חיבור, `removedAt` | עד מחיקת החדר |
| תשובות/ניקוד/הישגים/התקדמות | `StudentAnswer`, `ScoreEvent`, `StudentAchievement`, `ParticipantProgress` | תשובה שנבחרה, נכונות, זמן תגובה, נקודות | עד מחיקת החדר (cascade) |
| חדר/סבב/שאלות | `GameRoom`, `GameSession`, `SessionQuestion`, `Question` | הגדרות, קוד, מצבים, זמנים | עד מחיקה; חדר הופך `EXPIRED` אחרי 24h אך נשמר לדוחות |
| יומן ביקורת | `AuditLog` | פעולות מורה (`GAME_CREATED`, `PLAYER_JOINED` עם שם התצוגה, `PARTICIPANT_REMOVED`, `ROOM_EXPIRED`, …) | עד מחיקת החדר; רשומת `ROOM_DELETED` נשארת ללא פרטי תלמידים |
| מורה | `Teacher` | אימייל, hash סיסמה (argon2id), שם | כל עוד החשבון קיים |
| לוגים | stdout (docker json-file, 5×10MB) | מתודה, URL ממוסך, סטטוס, מזהה בקשה. ללא שמות, tokens, cookies, IPs | רוטציה אוטומטית |
| גיבויים | volume `backups` | `pg_dump` יומי | 14 יום (`BACKUP_KEEP_DAYS`) |

**מחיקה**: `DELETE /api/games/:id` (`GamesService.deleteGame`) מוחקת קשיח את החדר, הסבבים (cascade: שאלות סבב, תשובות, ניקוד, הישגים, התקדמות), המשתתפים, רשומות ה־`Student` שאינן מקושרות לחדר אחר, יומן הביקורת של החדר והשאלות שנוצרו עבורו. נבדק ב־`src/games/game-flow.int.test.ts`. מחיקה מגיבויים מתבצעת עם תפוגת הגיבוי (14 יום) – בקשת מחיקה מלאה דורשת גם ניקוי/החלפת גיבויים.

**המלצה למורה**: למחוק חדרים שאינם נחוצים אחרי ייצוא הדוח; אין צורך לשמור חדרים מעבר לשנת הלימודים.

## 4. רשימת בדיקה לפריסה

- [ ] **HTTPS בלבד** – nginx עם Let's Encrypt (`scripts/init-letsencrypt.sh`); `APP_URL`/`CORS_ORIGINS` עם `https://`. בלי HTTPS ה־cookie (`Secure`) לא יישלח.
- [ ] **סודות** – `JWT_SECRET`, `COOKIE_SECRET` ≥32 תווים אקראיים (`openssl rand -base64 48`); `POSTGRES_PASSWORD` חזק; `TEACHER_INITIAL_PASSWORD` מוחלף לפני ה־seed. `.env` לא ב־git ובהרשאות `600`.
- [ ] **`NODE_ENV=production`** – מפעיל אכיפת סודות, `Secure` cookies, `trust proxy=1`, לוגים ללא pino-pretty.
- [ ] **`TRUST_PROXY`** שווה למספר ה־proxies האמיתי (1 = nginx של ה־compose). לא להגדיל "ליתר ביטחון".
- [ ] **DB לא חשוף** – `db` ללא `ports:` בפרודקשן, ברשת `backend` פנימית בלבד (`docker-compose.prod.yml`).
- [ ] **CORS_ORIGINS** – רק הדומיין של האפליקציה (ללא `*`, ללא localhost).
- [ ] **גיבויים** – sidecar `backup` פעיל; לבדוק שחזור (`scripts/restore-db.sh`) לפחות פעם אחת; הגיבויים מכילים שמות תצוגה – לשמור על volume מוגן.
- [ ] **עדכונים** – `pnpm audit` / עדכון אימג'ים (node, postgres, nginx) תקופתי.
- [ ] **לוגים** – `docker compose logs` לא מכיל tokens/שמות (רדקציה פעילה); לא להעלות `LOG_LEVEL=debug` בפרודקשן.
- [ ] **בדיקה אחרי פריסה** – `GET /api/health` מחזיר `{ status: 'ok' }`; `POST /api/games` ללא כותרת `X-Requested-With` מחזיר 403; `GET /api/rooms/000000` מחזיר 404 ואחרי ~60 בקשות 429.

## 5. סיכונים שיוריים

- ניחוש קוד חדר: 1M אפשרויות × 60 ניסיונות/דקה/IP (ועוד nginx) × חלון 24h ← יש להשאיר `joinOpen=false` אחרי שכל התלמידים נכנסו (המורה סוגרת הצטרפות; `start` לא סוגר אוטומטית).
- מגבלת קצב לפי IP מאחורי NAT של בית ספר משותפת לכל הכיתה – לכן הערכים נדיבים; הגנה עומק ב־nginx.
- מסנן השמות הוא רשימת מילים בסיסית (`packages/shared/src/nameFilter.ts`); המורה יכולה להסיר משתתף עם שם לא הולם (`DELETE .../participants/:id`).
