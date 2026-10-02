import { expect, test } from '@playwright/test';
import { db, markLeagueSeen, setPlayer } from './db';

test.describe('Profile, achievements and settings', () => {
  test('achievement popup after 1 000 taps, profile shows it with stats', async ({ page }) => {
    const uid = 700001201;
    await page.goto(`/?uid=${uid}&name=Ачивка`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { totalTaps: 995 });
    // награда за тапы поднимет в Silver — сцену лиги считаем уже показанной
    await markLeagueSeen(page, uid, 1);
    await page.reload();
    await expect(page.getByTestId('office')).toBeVisible();

    const cat = page.getByTestId('tap-button');
    for (let i = 0; i < 6; i++) await cat.click();
    // пачка тапов уходит на сервер, в ответе — новое достижение
    const popup = page.getByTestId('achievement-popup').first();
    await expect(popup).toBeVisible({ timeout: 15_000 });
    await expect(popup).toContainText('Разминка лапок');
    const shots = process.env.SCREENSHOTS;
    if (shots) {
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${shots}/20-achievement-popup.png` });
    }
    await popup.click();

    await expect(page.getByTestId('profile')).toBeVisible();
    await expect(page.getByTestId('profile-name')).toContainText('Ачивка');
    await expect(page.getByTestId('stat-totalTaps')).toHaveText(/^1\s00\d$/);
    await expect(page.getByTestId('achievement-taps_1k')).toHaveAttribute('data-unlocked', 'true');
    await expect(page.getByTestId('achievement-taps_10k')).toHaveAttribute('data-unlocked', 'false');
    await expect(page.getByTestId('achievements-count')).toContainText(/^[1-9]\d* из \d+$/);
    if (shots) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${shots}/21-profile.png` });
    }

    await page.getByTestId('achievement-taps_10k').click();
    const sheet = page.getByTestId('achievement-sheet');
    await expect(sheet).toContainText('Сделай 10 000 тапов');
    await expect(sheet.getByTestId('achievement-progress')).toContainText(/1\s00\d \/ 10\s000/);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // всплывающее уведомление не повторяется после перезахода
    await page.reload();
    await expect(page.getByTestId('office')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('achievement-popup')).toHaveCount(0);
    const user = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
    expect(user.newAchievementIds).toEqual([]);
  });

  test('settings: language, sound, animations and headquarters are saved', async ({ page }) => {
    const uid = 700001202;
    await page.goto(`/?uid=${uid}&name=Настройщик`);
    await expect(page.getByTestId('office')).toBeVisible();
    // первая штаб-квартира и её достижения поднимут в Silver — сцену лиги проверяет leagues.spec
    await markLeagueSeen(page, uid, 1);
    await page.getByTestId('open-settings').click();
    const settings = page.getByTestId('settings');
    await expect(settings).toBeVisible();
    await expect(settings).toContainText('Язык');
    const shots = process.env.SCREENSHOTS;
    if (shots) await page.screenshot({ path: `${shots}/22-settings.png` });

    await page.getByTestId('settings-language-en').click();
    await expect(settings).toContainText('Language');
    await page.getByTestId('settings-sound').click();
    await expect(page.getByTestId('settings-sound')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('settings-animations-reduced').click();

    await page.getByTestId('settings-hq').click();
    await page.getByTestId('hq-moon_harbor').click();
    await page.getByTestId('hq-save').click();
    await expect(page.getByText('Headquarters: Moon Harbor')).toBeVisible();

    await expect
      .poll(async () => (await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } })).settings)
      .toMatchObject({ language: 'en', sound: false, animations: 'reduced' });

    // после перезахода — всё на английском, штаб-квартира сохранена
    await page.reload();
    await expect(page.getByTestId('player-hq')).toHaveText('CEO · Moon Harbor');
    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('settings-sound')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('settings-animations-reduced')).toHaveAttribute('aria-checked', 'true');
  });

  test('account deletion asks for confirmation and starts over', async ({ page }) => {
    const uid = 700001203;
    await page.goto(`/?uid=${uid}&name=Уходящий`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { balance: 12345, totalEarned: 12345, leagueLevel: 1 });
    await page.getByTestId('open-settings').click();
    await page.getByTestId('settings-delete').click();
    const confirm = page.getByTestId('delete-confirm');
    await expect(confirm).toBeDisabled();
    await expect(confirm).toBeEnabled({ timeout: 5_000 });
    await confirm.click();

    await expect(page.getByTestId('screen-deleted')).toBeVisible();
    expect(await db.user.findUnique({ where: { telegramId: BigInt(uid) } })).toBeNull();
    await page.getByRole('button', { name: 'Начать заново' }).click();
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '0');
  });
});
