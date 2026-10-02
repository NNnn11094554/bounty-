import { expect, test } from '@playwright/test';
import { db } from './db';

test.describe('Shop (Telegram Stars)', () => {
  test('coin pack and income ×2: delivered after payment, badge on the office', async ({ page }) => {
    const uid = 700001501;
    await page.goto(`/?uid=${uid}&name=Покупатель`);
    await expect(page.getByTestId('office')).toBeVisible();

    await page.getByTestId('open-shop').click();
    const shop = page.getByTestId('shop');
    await expect(shop).toBeVisible();
    await expect(page.getByTestId('shop-coins_small')).toContainText('25 000');
    await expect(page.getByTestId('shop-coins_medium')).toContainText('+50%');
    await expect(page.getByTestId('buy-coins_large')).toContainText('250');
    const shots = process.env.SCREENSHOTS;
    if (shots) await page.screenshot({ path: `${shots}/28-shop.png` });

    // вне Telegram счёт — dev-invoice://, оплату имитирует сервер
    const before = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
    await page.getByTestId('buy-coins_small').click();
    await expect(page.getByTestId('toast-success')).toBeVisible();
    const after = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
    expect(after.balance.toNumber() - before.balance.toNumber()).toBeGreaterThanOrEqual(25_000);
    // купленные монеты не двигают лигу
    expect(after.totalEarned.toNumber() - before.totalEarned.toNumber()).toBeLessThan(25_000);

    await page.getByTestId('buy-income_x2').click();
    await expect(page.getByTestId('income-boost-left')).toBeVisible();
    const purchases = await db.purchase.findMany({ where: { userId: after.id }, orderBy: { id: 'asc' } });
    expect(purchases.map((p) => [p.productId, p.status])).toEqual([
      ['coins_small', 'PAID'],
      ['income_x2', 'PAID'],
    ]);

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('income-boost-badge')).toBeVisible();
  });
});
