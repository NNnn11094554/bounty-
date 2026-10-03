import { expect, test } from '@playwright/test';
import { db } from './db';

test.describe('Shop (Telegram Stars)', () => {
  test('coin pack and income ×2: delivered after payment, badge on the office', async ({ page }) => {
    const uid = 700001501;
    await page.goto(`/?uid=${uid}&name=Покупатель`);
    await expect(page.getByTestId('office')).toBeVisible();

    await page.getByTestId('nav-shop').click();
    const shop = page.getByTestId('shop');
    await expect(shop).toBeVisible();
    // разделы: скины (по умолчанию), бусты, особое, эффекты
    await expect(page.getByTestId('shop-skins')).toBeVisible();
    await page.getByTestId('shop-tabs-special').click();
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

    await page.getByTestId('shop-tabs-boosts').click();
    await page.getByTestId('buy-income_x2').click();
    await expect(page.getByTestId('income-boost-left')).toBeVisible();
    const purchases = await db.purchase.findMany({ where: { userId: after.id }, orderBy: { id: 'asc' } });
    expect(purchases.map((p) => [p.productId, p.status])).toEqual([
      ['coins_small', 'PAID'],
      ['income_x2', 'PAID'],
    ]);

    await page.getByTestId('nav-office').click();
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('income-boost-badge')).toBeVisible();
  });

  test('assets section: Stars assets from cheap to expensive; unlocking one moves it to the assets screen', async ({
    page,
  }) => {
    const uid = 700001503;
    await page.goto(`/?uid=${uid}&name=Криптокот`);
    await expect(page.getByTestId('office')).toBeVisible();
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('shop-tabs-assets').click();
    const list = page.getByTestId('shop-assets');
    await expect(list).toContainText('Игровые активы — не настоящая криптовалюта');
    const rows = list.locator('[data-testid^="shop-asset-"]');
    await expect(rows.first()).toBeVisible();
    // цены в Stars идут по возрастанию
    const prices = (await rows.locator('span.tabular').allTextContents()).map(Number);
    expect(prices.length).toBeGreaterThan(40);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    // бесплатных (за монеты) активов здесь нет
    await expect(page.getByTestId('shop-asset-doge')).toHaveCount(0);

    // Litecoin — без условий: открыть за Stars прямо из магазина
    await page.getByTestId('shop-asset-ltc').click();
    await page.getByTestId('card-unlock').click();
    await expect(page.getByTestId('toast-success')).toContainText('Litecoin');
    await expect(page.getByTestId('shop-asset-ltc')).toHaveCount(0);
    const user = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
    const owned = await db.userCard.findUniqueOrThrow({
      where: { userId_cardId: { userId: user.id, cardId: 'ltc' } },
    });
    expect(owned.level).toBe(1);
    expect(Number(user.profitPerHour)).toBeGreaterThan(0);
  });
});
