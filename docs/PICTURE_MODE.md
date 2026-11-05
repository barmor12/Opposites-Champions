# מצב "תמונות בלבד" (רמה קלה ללא קריאה)

דרישה: רמת משחק קלה שבה **אין צורך בקריאה בכלל** – השאלה והתשובות מוצגות בתמונות בלבד, עם הקראה קולית אופציונלית.

## עיצוב הפתרון
- **סוג שאלה חדש**: `PICTURE_TO_PICTURE` (תווית: "תמונה מול תמונה – ללא קריאה").
  - מקור: זוגות `imageable` בלבד (61 זוגות עם איורים).
  - Prompt: איור המילה הראשונה בלבד (ללא טקסט המילה; המילה נשמרת ב־`prompt` לצורך הקראה ודוחות).
  - אפשרויות: 4 איורים – איור ההפך + 3 איורים של מילים אחרות (מאותה קטגוריה אם אפשר), ללא כיתוב טקסט על הכרטיסים. `QuestionOptionView.text` נשמר רק ל־alt/הקראה.
  - תמיכה בכל זרימות הניקוד/הדירוג הקיימות (אותו מנגנון כמו `CHOOSE_IMAGE`).
- **הקראה קולית (TTS)** בצד הלקוח: כפתור רמקול ליד התמונה + על כל כרטיס (`speechSynthesis`, קול `he-IL` אם קיים; אם אין – הכפתור מוסתר). ללא שירות חיצוני.
- **הגדרת משחק (מורה)**: בחירת סוג השאלה ברשימת הסוגים + כפתור "פריסט" בעמוד יצירת משחק: **"רמה קלה – תמונות בלבד"** = סוגי שאלות `[PICTURE_TO_PICTURE]`, רמת קושי `EASY`, ללא הגבלת זמן, הצגת תשובות נכונות פעילה, אתגר אוצר כבוי. ממשק המורה מציג תג "ללא קריאה" על חדרים כאלה.
- **צד תלמיד**: הרנדרר מציג תמונות גדולות (prompt ≥ 40% גובה המסך בטלפון), כרטיסי אפשרויות ריבועיים 2×2, משוב בלי טקסט ארוך (אייקון ✓/✗ גדול + אנימציה + צליל), כפתור "המשך" עם אייקון חץ גדול (הטקסט נשאר לנגישות).
- **דוחות**: `correctAnswerText` = המילה המנוגדת; התפלגות תשובות לפי שם המילה (כמו היום).

## שינויים נדרשים
1. `packages/shared/src/enums.ts` – להוסיף `PICTURE_TO_PICTURE` ל־`QuestionType` + תווית.
2. `packages/content` – `IMAGEABLE_QUESTION_TYPES` כולל את הסוג החדש.
3. `apps/server/prisma/schema.prisma` – enum `QuestionType` + migration `add_picture_to_picture`.
4. `apps/server/src/questions/questions.service.ts` – בניית שאלות מסוג זה (prompt ללא טקסט בתצוגה: `QuestionView.prompt` = המילה (להקראה), `promptImage` חובה, `options[].image` חובה, `options[].text` = המילה (alt)); treasure אינו משתמש בסוג זה (או משתמש – לשיקול: מותר).
5. `apps/web/src/games` – `PictureQuestion.tsx` (או הרחבת `ChoiceQuestion` במצב `pictureOnly`), TTS hook `useSpeech.ts`.
6. `apps/web/src/pages/teacher/CreateGamePage.tsx` + `gameSettingsForm.ts` – פריסט "רמה קלה – תמונות בלבד"; תוויות.
7. בדיקות: unit (generation, no text leakage), int (flow with PICTURE_TO_PICTURE), web (renderer), E2E (preset creates a picture-only game and a student answers via image tiles).
