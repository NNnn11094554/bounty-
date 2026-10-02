import { expect, test } from '@playwright/test';
import { markLeagueSeen, setPlayer } from './db';

test.describe('Boosts', () => {
  test('full energy refills energy and returns to the office', async ({ page }) => {
    const uid = 700000301;
    await page.goto(`/?uid=${uid}&name=Буст`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { energy: 100, energyUpdatedAt: new Date() });
    await page.reload();
    await expect(page.getByTestId('energy-value')).toHaveText(/^10\d \/ 1000$/);

    await page.getByTestId('open-boosts').click();
    await expect(page.getByTestId('boosts')).toBeVisible();
    await expect(page.getByTestId('boost-full-energy')).toContainText('6/6');
    await page.getByTestId('boost-full-energy').click();
    await page.getByTestId('boost-confirm').click();
    await expect(page.getByTestId('boosts')).toBeHidden();
    await expect(page.getByTestId('energy-value')).toHaveText('1000 / 1000');

    await page.getByTestId('open-boosts').click();
    await expect(page.getByTestId('boost-full-energy')).toContainText(/мин/);
  });

  test('multitap purchase raises tap value; insufficient funds disables the button', async ({ page }) => {
    const uid = 700000302;
    await page.goto(`/?uid=${uid}&name=Покупатель`);
    await expect(page.getByTestId('office')).toBeVisible();
    await page.getByTestId('open-boosts').click();
    await page.getByTestId('boost-multitap').click();
    await expect(page.getByTestId('boost-confirm')).toBeDisabled();
    await expect(page.getByTestId('boost-confirm')).toHaveText('Недостаточно монет');
    await page.getByTestId('sheet-close').click();

    await setPlayer(uid, { balance: 5000, totalEarned: 5000 });
    await markLeagueSeen(page, uid, 1);
    await page.reload();
    await page.getByTestId('open-boosts').click();
    await page.getByTestId('boost-multitap').click();
    await expect(page.getByTestId('boost-sheet')).toContainText('2K');
    await page.getByTestId('boost-confirm').click();
    await expect(page.getByTestId('boost-multitap')).toContainText('4K');
    await expect(page.getByTestId('boost-multitap')).toContainText('3 lvl');
    await page.keyboard.press('Escape'); // «Назад» — как кнопка BackButton в Telegram
    await expect(page.getByTestId('boosts')).toBeHidden();
    await expect(page.getByTestId('stat-per-tap')).toHaveText('+2');
    // 5 000 + 2 000 (достижение «Серебряный кот») − 2 000 за Multitap
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^5\s000$/);
  });

  test('how boosts work sheet opens and closes with a swipe', async ({ page }) => {
    await page.goto('/?uid=700000303&name=Читатель');
    await page.getByTestId('open-boosts').click();
    await page.getByText('Как работает усиление').click();
    const sheet = page.getByTestId('boost-how');
    await expect(sheet).toBeVisible();
    const dialog = sheet.getByRole('dialog');
    const box = (await dialog.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 20);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 300, { steps: 8 });
    await page.mouse.up();
    await expect(sheet).toBeHidden();
  });
});
