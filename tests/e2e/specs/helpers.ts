import { nikudInsensitive } from '@oc/shared';

/** טקסט עברי במסך מנוקד – ההתאמה בבדיקות מתעלמת מניקוד (| מפריד חלופות) */
export const heb = (text: string): RegExp => new RegExp(text.split('|').map((t) => nikudInsensitive(t).source).join('|'));

import { expect, type Browser, type Page } from '@playwright/test';

export const TEACHER_EMAIL = process.env.TEACHER_INITIAL_EMAIL ?? 'teacher@example.com';
export const TEACHER_PASSWORD = process.env.TEACHER_INITIAL_PASSWORD ?? 'change-me-teacher-password';

export async function teacherLogin(page: Page): Promise<void> {
  await page.goto('/teacher/login');
  await page.getByLabel(heb('דוא|אימייל|מייל')).fill(TEACHER_EMAIL);
  await page.getByLabel(heb('סיסמה')).fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: heb('התחבר') }).click();
  await expect(page).toHaveURL(/\/teacher(\/)?$/);
}

/** יוצר משחק דרך ה-API של המורה (מהיר יותר מהטופס) ומחזיר את הקוד ואת מזהה החדר */
export async function createGameViaApi(
  page: Page,
  overrides: Record<string, unknown> = {},
): Promise<{ roomId: string; code: string }> {
  const res = await page.request.post('/api/games', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
    data: {
      className: 'כיתה ג׳ בדיקה',
      questionCount: 10,
      difficulty: 'MIXED',
      categories: [
        'SIZES', 'COLORS_LIGHT', 'EMOTIONS', 'ACTIONS', 'TIME_SPEED',
        'DIRECTIONS_PLACES', 'ANIMALS_NATURE', 'TRAITS_STATES', 'OBJECTS_ENVIRONMENT', 'CHALLENGING',
      ],
      timePerQuestionSec: 0,
      questionTypes: ['CHOOSE_OPPOSITE', 'COMPLETE_SENTENCE'],
      mode: 'SELF_PACED',
      competitionEnabled: true,
      showLeaderboard: true,
      showCorrectAnswers: true,
      soundsEnabled: false,
      treasureChallenge: false,
      ...overrides,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  const body = (await res.json()) as { roomId: string; code: string };
  return { roomId: body.roomId, code: body.code };
}

/** בוחר אווטאר (שדה חובה בטופס ההצטרפות) */
export async function pickAvatar(page: Page): Promise<void> {
  const radio = page.getByRole('radio').first();
  if (await radio.isVisible().catch(() => false)) {
    await radio.click();
    return;
  }
  await page.getByText(heb('אריה'), { exact: true }).first().click();
}

export async function joinAsStudent(browser: Browser, code: string, name: string): Promise<Page> {
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.goto(`/join/${code}`);
  await page.getByLabel(heb('שם')).first().fill(name);
  await pickAvatar(page);
  await page.getByRole('button', { name: heb('בואו נשחק') }).click();
  await expect(page.getByText(heb(`שלום ${name}`))).toBeVisible();
  await expect(page.getByText(heb('מחכים שהמורה'))).toBeVisible({ timeout: 15_000 });
  return page;
}

/** עונה על כל השאלות (בוחר תמיד את האפשרות הראשונה) עד למסך הסיום */
export async function answerAllQuestions(page: Page, maxQuestions = 25): Promise<void> {
  for (let i = 0; i < maxQuestions; i++) {
    // מסך "סיימת" (ממתינים לשאר הכיתה) או מעבר למסך התוצאות
    const finished = page.getByTestId('finished-screen');
    // רק כפתור פעיל של השאלה הנוכחית (כפתור השאלה הקודמת נשאר מושבת לרגע באנימציית היציאה)
    const option = page.locator('[data-testid="option-1"]:not([aria-disabled="true"])');
    const matchCheck = page.getByTestId('check-button');
    const matchCard = page.locator('[data-testid^="card-"]');
    await Promise.race([
      option.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined),
      matchCard.first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined),
      finished.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined),
    ]);
    if (await finished.isVisible().catch(() => false)) return;
    if (/\/results/.test(page.url()) || (await page.getByTestId('results-page').isVisible().catch(() => false))) return;
    if (await matchCard.first().isVisible().catch(() => false)) {
      const cards = await matchCard.all();
      for (let c = 0; c + 1 < cards.length; c += 2) {
        await cards[c]!.click();
        await cards[c + 1]!.click();
      }
      await matchCheck.click();
    } else if (await option.isVisible().catch(() => false)) {
      // ממתינים שהשאלה החדשה תיטען (הכפתור של השאלה הקודמת נשאר מושבת לרגע)
      await option.click();
    }
    // אחרי תשובה: כפתור "המשך", או (בשאלה האחרונה) מעבר ישיר למסך הסיום/התוצאות
    const next = page.getByTestId('next-button');
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (await next.isVisible().catch(() => false)) {
        await next.click().catch(() => undefined);
        break;
      }
      if (await finished.isVisible().catch(() => false)) return;
      if (/\/results/.test(page.url())) return;
      await page.waitForTimeout(150);
    }
  }
}

/** לוחץ "סיים משחק" אם המשחק עדיין פעיל (כשכל התלמידים סיימו המשחק מסתיים אוטומטית) */
export async function finishGameIfNeeded(page: Page): Promise<void> {
  const btn = page.getByRole('button', { name: heb('סיים משחק') });
  const visible = await btn.isVisible().catch(() => false);
  if (!visible) return;
  await btn.click({ timeout: 10_000 }).catch(() => undefined);
}
