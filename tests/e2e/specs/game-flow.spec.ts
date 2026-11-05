import { expect, test } from '@playwright/test';
import { answerAllQuestions, createGameViaApi, finishGameIfNeeded, heb, joinAsStudent, pickAvatar, teacherLogin } from './helpers';

test.describe('זרימת משחק מלאה', () => {
  test('מורה יוצרת חדר, תלמידים מצטרפים, משחקים ורואים דירוג', async ({ page, browser }) => {
    test.setTimeout(300_000);
    await teacherLogin(page);
    const { roomId, code } = await createGameViaApi(page);
    expect(code).toMatch(/^\d{6}$/);

    await page.goto(`/teacher/rooms/${roomId}`);
    await expect(page.getByText(code, { exact: true }).first()).toBeVisible();

    const student1 = await joinAsStudent(browser, code, 'נועה');
    const student2 = await joinAsStudent(browser, code, 'יואב');

    // מניעת שם כפול
    const dupCtx = await browser.newContext();
    const dup = await dupCtx.newPage();
    await dup.goto(`/join/${code}`);
    await dup.getByLabel(heb('שם')).first().fill('נועה');
    await pickAvatar(dup);
    await dup.getByRole('button', { name: heb('בואו נשחק') }).click();
    await expect(dup.getByText(heb('תפוס'))).toBeVisible();
    await dupCtx.close();

    // המורה רואה 2 תלמידים (האריחים נטענים באנימציה כשהם נכנסים לתצוגה)
    for (const name of ['נועה', 'יואב']) {
      const tile = page.getByText(name, { exact: true }).first();
      await tile.waitFor({ state: 'attached', timeout: 15_000 });
      await tile.scrollIntoViewIfNeeded();
      await expect(tile).toBeVisible();
    }

    await page.getByRole('button', { name: heb('התחל משחק') }).click();

    // רענון באמצע משחק לא מאבד את ההתחברות
    await student2.reload();
    await Promise.all([answerAllQuestions(student1), answerAllQuestions(student2)]);

    await finishGameIfNeeded(page);

    // כל התלמידים עוברים למסך התוצאות עם מדליות
    await student1.waitForURL(/\/results/, { timeout: 20_000 });
    await student2.waitForURL(/\/results/, { timeout: 20_000 });
    await expect(student1.getByAltText(heb('זהב')).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`/teacher/rooms/${roomId}/results`);
    await expect(page.getByText(heb('ממוצע'))).toBeVisible();
    await expect(page.getByText(heb('נועה'), { exact: true }).first()).toBeVisible();
  });

  test('קוד חדר שגוי מציג שגיאה ידידותית', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(heb('שם')).first().fill('דנה');
    await page.getByLabel(heb('קוד')).first().fill('000000');
    await pickAvatar(page);
    await page.getByRole('button', { name: heb('בואו נשחק') }).click();
    await expect(page.getByText(heb('לא נמצא|לא קיים'))).toBeVisible();
  });

  test('RTL ותמונות נטענות במסך הפתיחה', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const sun = page.locator('img[src*="characters/sun"]').first();
    await expect(sun).toBeVisible();
    const ok = await sun.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
    expect(ok).toBeTruthy();
  });
});

test.describe('רמה קלה – תמונות בלבד', () => {
  test('תלמיד משחק משחק של תמונות בלבד ומגיע לתוצאות', async ({ page, browser }) => {
    test.setTimeout(240_000);
    await teacherLogin(page);
    const { roomId, code } = await createGameViaApi(page, {
      className: 'כיתה א׳ תמונות',
      questionTypes: ['PICTURE_TO_PICTURE'],
      difficulty: 'EASY',
      timePerQuestionSec: 0,
      treasureChallenge: false,
    });
    const student = await joinAsStudent(browser, code, 'איתן');
    await page.goto(`/teacher/rooms/${roomId}`);
    await page.getByRole('button', { name: heb('התחל משחק') }).click();

    // האפשרויות הן תמונות בלבד – לכל כרטיס יש תמונה ואין טקסט גלוי של המילה
    const firstTile = student.locator('[data-testid="option-1"]:not([aria-disabled="true"])');
    await firstTile.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(firstTile.locator('img')).toHaveCount(1);

    await answerAllQuestions(student);
    await finishGameIfNeeded(page);
    await student.waitForURL(/\/results/, { timeout: 20_000 });
    await expect(student.getByTestId('results-page')).toBeVisible();
  });
});
