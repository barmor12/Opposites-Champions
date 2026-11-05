# חוזה API – אלופי ההפכים

כל ה־DTOs/טיפוסים מוגדרים ב־`packages/shared/src/types.ts` ואירועי Socket ב־`packages/shared/src/socket.ts`. השרת והלקוח חייבים להשתמש בהם ולא להגדיר כפילויות.

כללי:
- Base path: `/api`. תגובות JSON. שגיאות: `{ statusCode, message, error }` (NestJS standard). `message` בעברית, קצר וידידותי.
- **מורה**: אימות דרך cookie `oc_teacher` (JWT, HttpOnly, SameSite=Lax, Secure בפרודקשן). CSRF: בקשות משנות-מצב דורשות header `X-Requested-With: XMLHttpRequest` (נבדק ב־guard).
- **תלמיד**: אחרי `POST /api/rooms/join` מתקבל `sessionToken` (אקראי, 32 bytes base64url). נשלח ב־header `x-player-token` (קבוע `SESSION_TOKEN_HEADER`) ובהתחברות socket ב־`auth.token`. הלקוח שומר אותו ב־`localStorage` (`oc.player.token`) לצורך התחברות חוזרת אחרי רענון.

## Teacher auth
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /api/auth/login | `{ email, password }` | `TeacherProfile` + sets cookie |
| POST | /api/auth/logout | – | `{ ok: true }` clears cookie |
| GET | /api/auth/me | – | `TeacherProfile` (401 if none) |

## Games (teacher, auth required)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /api/games | `GameSettings` | `GameSummary` (room with code, state WAITING_FOR_PLAYERS, joinOpen true, session #1 created) |
| GET | /api/games | – | `GameSummary[]` (של המורה, חדשים קודם) |
| GET | /api/games/:id | – | `TeacherRoomLive` |
| POST | /api/games/:id/start | – | `TeacherRoomLive` (WAITING→COUNTDOWN→QUESTION_ACTIVE; שידור socket) |
| POST | /api/games/:id/pause | – | `TeacherRoomLive` |
| POST | /api/games/:id/resume | – | `TeacherRoomLive` |
| POST | /api/games/:id/finish | – | `TeacherRoomLive` (→ FINAL_RESULTS → COMPLETED, הענקת הישגים) |
| POST | /api/games/:id/next | – | `TeacherRoomLive` (teacher-paced: מעבר לשאלה הבאה / סיום) |
| POST | /api/games/:id/join-open | `{ open: boolean }` | `TeacherRoomLive` |
| POST | /api/games/:id/new-round | – | `GameSummary` (סבב חדש באותו חדר עם אותם משתתפים, ניקוד מאופס לסבב) |
| POST | /api/games/:id/cancel | – | `TeacherRoomLive` |
| DELETE | /api/games/:id/participants/:participantId | – | `TeacherRoomLive` (הסרת תלמיד, ניתוק socket) |
| GET | /api/games/:id/results | `?sessionId=` optional (ברירת מחדל: הסבב הנוכחי/אחרון) | `GameResults` |
| GET | /api/games/:id/export?format=csv\|xlsx&sessionId= | – | קובץ להורדה |
| DELETE | /api/games/:id | – | `{ ok: true }` מחיקת חדר + נתוני תלמידים (מדיניות מחיקה) |
| GET | /api/games/stats/overview | – | `{ activeRooms, totalSessions, totalParticipants, averageAccuracy }` |

## Student
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /api/rooms/join | `JoinRoomRequest` | `JoinRoomResponse` (400 אם השם תפוס/לא תקין, 404 חדר לא קיים, 403 הצטרפות סגורה). Rate-limited. |
| GET | /api/rooms/:code | – | `RoomPublicView` (ללא שמות תלמידים) |
| GET | /api/player/session | header token | `PlayerSession` (כולל השאלה הפעילה אם יש – לשחזור אחרי רענון) |
| GET | /api/player/progress | header token | `{ score, correctAnswers, answeredCount, finished, currentIndex, total, achievements }` |

## Content (teacher auth)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | /api/word-pairs?category=&difficulty=&search=&page=&limit= | – | `{ items: WordPairContent[] (with id=uuid, slug), total }` |
| POST | /api/word-pairs | `Omit<WordPairContent,'id'> & { slug? }` | `WordPairContent` |
| PATCH | /api/word-pairs/:id | partial | `WordPairContent` |
| DELETE | /api/word-pairs/:id | – | soft delete `{ ok: true }` |
| GET | /api/categories | – | `Array<{ id: Category; label: string; count: number }>` |
| GET | /api/media | – | `Array<{ key, kind, url, alt }>` |

## Health
`GET /api/health` → `{ status: 'ok', db: 'ok'|'error', uptime }`.

## Socket.IO
Namespace: `/` (default). Path `/socket.io`. Auth handshake: `{ token: sessionToken }` לתלמיד, או cookie `oc_teacher` למורה.
חדרים: `room:<roomId>` (כל המשתתפים + המורה), `teacher:<roomId>` (רק מורה), `participant:<participantId>`.
אירועים – ראו `ClientToServerEvents` / `ServerToClientEvents`.

### זרימת Self-paced (ברירת מחדל)
1. מורה `start` → state `COUNTDOWN` ל־3 שניות → `QUESTION_ACTIVE`. לכל משתתף נשלח `question:started` עם השאלה הראשונה שלו (לפי `ParticipantProgress.currentIndex`). `questionStartedAt` נשמר בשרת ב־ParticipantProgress.
2. תלמיד שולח `answer:submit` (socket) → השרת מאמת, מחשב ניקוד, מחזיר `answer:result` ב־ack, משדר `leaderboard:updated` לחדר (throttled ~500ms).
3. הלקוח מציג תוצאה ואז שולח `question:next` → השרת מחזיר את השאלה הבאה (ומעדכן `questionStartedAt`) או `finished: true` (ParticipantProgress.finished) ומשדר `player:finished`.
4. כשכל המשתתפים המחוברים סיימו, או המורה לחצה סיום → `FINAL_RESULTS` → `game:finished` + `achievement:awarded` → `COMPLETED`.
5. פג זמן (timeLimit) בלי תשובה: הלקוח שולח `question:next` ללא תשובה; השרת רושם `StudentAnswer` עם isCorrect=false, elapsed=timeLimit, score 0 (אם לא קיימת תשובה).

### זרימת Teacher-paced
השאלה הפעילה היא `GameSession.currentQuestionIndex`; `SessionQuestion.startedAt/endsAt` בשרת. `question:started` משודר לכל החדר. בסיום הזמן / כל התלמידים ענו → `QUESTION_RESULTS` + `question:ended` (עם התשובה הנכונה – רק עכשיו). המורה לוחצת `next`.

### אתגר האוצר
כשהוא פעיל בהגדרות, 5 השאלות האחרונות בסט מסומנות `isTreasure` עם `treasureStep` 1..5 (`QuestionType` מתוך הסוגים הפעילים, ללא MATCH_PAIRS). בסיום 5 נכונות ברצף → בונוס `TREASURE_BONUS` (150) ב־`AnswerResult.treasureBonus`, `treasureCompleted: true`.

### אבטחה
- אין לשלוח `isCorrect` ללקוח לפני סגירת שאלה. `QuestionView.options` מעורבבים ללא דגל נכונות.
- ניקוד רק בשרת. `elapsedMs = now - questionStartedAt(server)`, clamp ל־[0, timeLimit].
- תשובה כפולה → unique constraint → 409 / ack error `ALREADY_ANSWERED`.
