import { expect, type Browser, type Page } from '@playwright/test';

export const TEACHER_EMAIL = process.env.TEACHER_INITIAL_EMAIL ?? 'teacher@example.com';
export const TEACHER_PASSWORD = process.env.TEACHER_INITIAL_PASSWORD ?? 'change-me-teacher-password';

export async function teacherLogin(page: Page): Promise<void> {
  await page.goto('/teacher/login');
  await page.getByLabel(/דוא|אימייל|מייל/).fill(TEACHER_EMAIL);
  await page.getByLabel(/סיסמה/).fill(TEACHER_PASSWORD);
  await page.getByRole('button', { name: /התחבר/ }).click();
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
  await page.getByText('אריה', { exact: true }).first().click();
}

export async function joinAsStudent(browser: Browser, code: string, name: string): Promise<Page> {
  const ctx = await browser.newContext({ locale: 'he-IL' });
  const page = await ctx.newPage();
  await page.goto(`/join/${code}`);
  await page.getByLabel(/שם/).first().fill(name);
  await pickAvatar(page);
  await page.getByRole('button', { name: /בואו נשחק/ }).click();
  await expect(page.getByText(new RegExp(`שלום ${name}`))).toBeVisible();
  await expect(page.getByText(/מחכים שהמורה/)).toBeVisible({ timeout: 15_000 });
  return page;
}

/** עונה על כל השאלות (בוחר תמיד את האפשרות הראשונה) עד למסך הסיום */
export async function answerAllQuestions(page: Page, maxQuestions = 25): Promise<void> {
  for (let i = 0; i < maxQuestions; i++) {
    const finished = page.getByText(/סיימת|תוצאות|מקום/).first();
    const option = page.getByTestId('option-1');
    const matchCheck = page.getByTestId('check-button');
    const matchCard = page.locator('[data-testid^="card-"]');
    await Promise.race([
      option.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined),
      matchCard.first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined),
      finished.waitFor({ state: 'visible', timeout: 20_000 }).catch(() => undefined),
    ]);
    if (await finished.isVisible().catch(() => false)) return;
    if (await matchCard.first().isVisible().catch(() => false)) {
      const cards = await matchCard.all();
      for (let c = 0; c + 1 < cards.length; c += 2) {
        await cards[c]!.click();
        await cards[c + 1]!.click();
      }
      await matchCheck.click();
    } else if (await option.isVisible().catch(() => false)) {
      // ממתינים שהשאלה החדשה תיטען (הכפתור של השאלה הקודמת נשאר מושבת לרגע)
      await expect(option).toBeEnabled({ timeout: 15_000 });
      await option.click();
    }
    const next = page.getByTestId('next-button');
    await next.waitFor({ state: 'visible', timeout: 15_000 });
    await next.click();
  }
}
