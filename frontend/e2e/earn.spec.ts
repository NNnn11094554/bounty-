import { expect, test } from '@playwright/test';
import { db, gameDay, setPlayer } from './db';

test.describe('Earn', () => {
  test('daily reward: claim day 1, then come back tomorrow', async ({ page }) => {
    await page.goto('/?uid=700000701&name=Ежедневка');
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('nav-badge-earn')).toBeVisible();
    await page.getByTestId('nav-earn').click();
    await expect(page.getByTestId('earn')).toBeVisible();
    await page.getByTestId('daily-row').click();

    const sheet = page.getByTestId('daily-sheet');
    await expect(sheet.getByTestId('daily-day-1')).toHaveAttribute('data-state', 'today');
    await expect(sheet.getByTestId('daily-day-10')).toContainText('5M');
    await sheet.getByTestId('daily-claim').click();
    await expect(sheet.getByTestId('daily-day-1')).toHaveAttribute('data-state', 'claimed');
    await expect(sheet.getByTestId('daily-claim')).toHaveText('Возвращайся завтра');
    await expect(sheet.getByTestId('daily-claim')).toBeDisabled();
    await expect(sheet).toContainText('Следующая награда через');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('nav-badge-earn')).toHaveCount(0);
    await expect(page.getByTestId('daily-row')).toContainText('Получено сегодня');

    await page.getByTestId('nav-office').click();
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '500');
  });

  test('daily reward: a missed day restarts the streak', async ({ page }) => {
    const uid = 700000702;
    await page.goto(`/?uid=${uid}&name=Пропустил`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { dailyRewardDay: 5, dailyStreak: 5, dailyRewardDayKey: gameDay(-3) });
    await page.reload();
    await page.getByTestId('nav-earn').click();
    await page.getByTestId('daily-row').click();
    await expect(page.getByTestId('daily-broken')).toBeVisible();
    await expect(page.getByTestId('daily-day-1')).toHaveAttribute('data-state', 'today');
  });

  test('daily reward: streak continues from yesterday', async ({ page }) => {
    const uid = 700000703;
    await page.goto(`/?uid=${uid}&name=Серия`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { dailyRewardDay: 3, dailyStreak: 3, dailyRewardDayKey: gameDay(-1) });
    await page.reload();
    await page.getByTestId('nav-earn').click();
    await expect(page.getByTestId('daily-row')).toContainText('5K');
    await page.getByTestId('daily-row').click();
    await expect(page.getByTestId('daily-day-3')).toHaveAttribute('data-state', 'claimed');
    await expect(page.getByTestId('daily-day-4')).toHaveAttribute('data-state', 'today');
    await expect(page.getByTestId('daily-streak')).toHaveText('Серия: 3 дня подряд');
  });

  test('link task: go, wait for the check, get the reward', async ({ page, context }) => {
    await db.task.upsert({
      where: { id: 'e2e_link' },
      create: {
        id: 'e2e_link',
        type: 'LINK',
        titleRu: 'Загляни на сайт',
        titleEn: 'Visit the site',
        url: 'https://example.com/',
        reward: 100_000n,
        checkDelaySec: 3,
        sortOrder: 99,
      },
      update: {},
    });
    await page.goto('/?uid=700000704&name=Задания');
    await page.getByTestId('nav-earn').click();
    const row = page.getByTestId('task-e2e_link');
    await expect(row).toContainText('+100 000');
    await row.click();
    const sheet = page.getByTestId('task-sheet');
    await expect(sheet.getByTestId('task-check')).toBeDisabled();

    const popup = context.waitForEvent('page');
    await sheet.getByTestId('task-go').click();
    await (await popup).close();
    await expect(sheet.getByTestId('task-check')).toHaveText(/Проверить через 00:0\d/);
    await expect(sheet.getByTestId('task-check')).toHaveText('Проверить', { timeout: 6000 });
    await sheet.getByTestId('task-check').click();
    await expect(sheet.getByRole('dialog')).toBeHidden();
    await expect(page.getByText('Задание выполнено: +100 000!')).toBeVisible();
    await expect(row.getByLabel('done')).toBeVisible();
  });

  test('invite task shows progress and is not completed without friends', async ({ page }) => {
    await page.goto('/?uid=700000705&name=Одиночка');
    await page.getByTestId('nav-earn').click();
    await page.getByTestId('task-invite_3').click();
    await expect(page.getByTestId('task-progress')).toHaveText('Друзей: 0 из 3');
    await page.getByTestId('task-check').click();
    await expect(page.getByText('Задание ещё не выполнено')).toBeVisible();
  });
});

test('daily reward sheet works on a small 320×568 screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?uid=700000706&name=Малыш');
  await page.getByTestId('nav-earn').click();
  await page.getByTestId('daily-row').click();
  const dialog = page.getByTestId('daily-sheet').getByRole('dialog');
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  await page.getByTestId('daily-claim').click();
  await expect(page.getByTestId('daily-day-1')).toHaveAttribute('data-state', 'claimed');
});
