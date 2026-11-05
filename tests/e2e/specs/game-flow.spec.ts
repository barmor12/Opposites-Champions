import { expect, test } from '@playwright/test';
import { answerAllQuestions, createGameViaApi, joinAsStudent, pickAvatar, teacherLogin } from './helpers';

test.describe('זרימת משחק מלאה', () => {
  test('מורה יוצרת חדר, תלמידים מצטרפים, משחקים ורואים דירוג', async ({ page, browser }) => {
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
    await dup.getByLabel(/שם/).first().fill('נועה');
    await pickAvatar(dup);
    await dup.getByRole('button', { name: /בואו נשחק/ }).click();
    await expect(dup.getByText(/תפוס/)).toBeVisible();
    await dupCtx.close();

    // המורה רואה 2 תלמידים
    await expect(page.getByText('נועה')).toBeVisible();
    await expect(page.getByText('יואב')).toBeVisible();

    await page.getByRole('button', { name: /התחל משחק/ }).click();

    await answerAllQuestions(student1);
    // רענון באמצע משחק לא מאבד את ההתחברות
    await student2.reload();
    await answerAllQuestions(student2);

    await page.getByRole('button', { name: /סיים משחק/ }).click();

    await expect(student1.getByText(/מקום|אלוף/).first()).toBeVisible({ timeout: 20_000 });
    await expect(student1.getByAltText(/מדליית זהב|זהב/).first()).toBeVisible();

    await page.goto(`/teacher/rooms/${roomId}/results`);
    await expect(page.getByText(/ממוצע/)).toBeVisible();
    await expect(page.getByText('נועה')).toBeVisible();
  });

  test('קוד חדר שגוי מציג שגיאה ידידותית', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/שם/).first().fill('דנה');
    await page.getByLabel(/קוד/).first().fill('000000');
    await pickAvatar(page);
    await page.getByRole('button', { name: /בואו נשחק/ }).click();
    await expect(page.getByText(/לא נמצא|לא קיים/)).toBeVisible();
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
