import { expect, test, type Page } from '@playwright/test';
import { db, markLeagueSeen, setPlayer } from './db';

/** Игрок с заработанным (уровень) и балансом; сцена новой лиги не перекрывает сценарий. */
async function player(page: Page, uid: number, totalEarned: number, balance: number) {
  await page.goto(`/?uid=${uid}&name=Коллекционер`);
  await expect(page.getByTestId('office')).toBeVisible();
  await setPlayer(uid, { totalEarned, balance, leagueLevel: totalEarned >= 1_000_000 ? 2 : 1 });
  await markLeagueSeen(page, uid, 9);
  await page.reload();
  await expect(page.getByTestId('office')).toBeVisible();
  return db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
}

test.describe('Skins and collection', () => {
  test('buy a skin for coins → equipped on the cat, kept after reload, base skin can be equipped back', async ({
    page,
  }) => {
    const uid = 700001601;
    const user = await player(page, uid, 52_000, 20_000); // уровень 3
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'black_crown');

    await page.getByTestId('nav-shop').click();
    await expect(page.getByTestId('shop-skins')).toBeVisible();
    await expect(page.getByTestId('cosmetic-black_crown')).toHaveAttribute('data-state', 'equipped');
    await expect(page.getByTestId('cosmetic-pink_angel')).toHaveAttribute('data-state', 'available');
    await expect(page.getByTestId('cosmetic-cyber')).toHaveAttribute('data-state', 'locked');

    await page.getByTestId('cosmetic-pink_angel').click();
    await expect(page.getByTestId('cosmetic-modal')).toBeVisible();
    await expect(page.getByTestId('cosmetic-name')).toHaveText('Розовый Ангел');
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cosmetic-pink_angel')).toHaveAttribute('data-state', 'equipped');

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.equippedSkinId).toBe('pink_angel');
    expect(user.balance.toNumber() - after.balance.toNumber()).toBe(10_000);
    // покупка — трата, а не заработок: уровень и лига не растут
    expect(after.totalEarned.toNumber()).toBe(user.totalEarned.toNumber());
    expect(await db.userCosmetic.count({ where: { userId: user.id } })).toBe(1);

    await page.getByTestId('nav-office').click();
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'pink_angel');
    // кот и кнопка TAP — картинки этого скина, и они есть на сервере
    await expect(page.getByTestId('hero-body')).toHaveAttribute('style', /pink_angel-body\.webp/);
    for (const part of ['body', 'tail', 'tap', 'thumb']) {
      const res = await page.request.get(`/assets/generated/hero/pink_angel-${part}.webp`);
      expect(res.ok()).toBe(true);
    }
    await page.reload();
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'pink_angel');

    // вкладка «Коллекция»: вернуть базовый скин
    await page.getByTestId('nav-collection').click();
    await expect(page.getByTestId('collection')).toBeVisible();
    await expect(page.getByTestId('collection-subtitle')).toContainText('открыто 3');
    await page.getByTestId('cosmetic-black_crown').click();
    await page.getByTestId('cosmetic-equip').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('nav-office').click();
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'black_crown');
  });

  test('locked skins cannot be bought; a new level unlocks them', async ({ page }) => {
    const uid = 700001602;
    const user = await player(page, uid, 52_000, 5_000_000); // уровень 3, денег много
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('cosmetic-cyber').click();
    await expect(page.getByTestId('cosmetic-locked')).toBeDisabled();
    await expect(page.getByTestId('cosmetic-locked')).toContainText('5');
    await page.keyboard.press('Escape');

    expect(await db.userCosmetic.count({ where: { userId: user.id } })).toBe(0);

    await setPlayer(uid, { totalEarned: 350_000, leagueLevel: 1 }); // уровень 5
    await page.reload();
    await page.getByTestId('nav-shop').click();
    await expect(page.getByTestId('cosmetic-cyber')).toHaveAttribute('data-state', 'available');
    await expect(page.getByTestId('cosmetic-crypto_king')).toHaveAttribute('data-state', 'locked');
    await page.getByTestId('cosmetic-cyber').click();
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
  });

  test('not enough coins: the buy button is disabled', async ({ page }) => {
    await player(page, 700001603, 52_000, 100);
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('cosmetic-pink_angel').click();
    await expect(page.getByTestId('cosmetic-buy')).toBeDisabled();
    await expect(page.getByTestId('cosmetic-modal')).toContainText('Не хватает монет');
  });

  test('premium skin for Stars: delivered after payment and equipped', async ({ page }) => {
    const uid = 700001604;
    const user = await player(page, uid, 0, 0);
    await page.getByTestId('nav-shop').click();
    await expect(page.getByTestId('cosmetic-diamond')).toHaveAttribute('data-state', 'available');
    await page.getByTestId('cosmetic-diamond').click();
    await expect(page.getByTestId('cosmetic-buy')).toContainText('149');
    // вне Telegram счёт — dev-invoice://, оплату имитирует сервер
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    const purchase = await db.purchase.findFirstOrThrow({ where: { userId: user.id } });
    expect([purchase.productId, purchase.status]).toEqual(['skin_diamond', 'PAID']);
    await page.keyboard.press('Escape');
    await page.getByTestId('nav-office').click();
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'diamond');
  });

  test('tap effects tab: buy and equip an effect', async ({ page }) => {
    const uid = 700001605;
    const user = await player(page, uid, 52_000, 10_000); // уровень 3 ≥ 2 для «Сердечек»
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('shop-tabs-cosmetics').click();
    await expect(page.getByTestId('shop-effects')).toBeVisible();
    await page.getByTestId('cosmetic-hearts').click();
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.equippedEffectId).toBe('hearts');
    expect(after.equippedSkinId).toBe('black_crown');
  });

  test('server errors: the purchase is not shown as done, loading error offers a retry', async ({ page }) => {
    const uid = 700001606;
    const user = await player(page, uid, 52_000, 20_000);
    await page.route('**/api/collection/*/buy', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"INTERNAL"}' }),
    );
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('cosmetic-pink_angel').click();
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('toast-error')).toBeVisible();
    await expect(page.getByTestId('cosmetic-buy')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cosmetic-pink_angel')).toHaveAttribute('data-state', 'available');
    expect(await db.userCosmetic.count({ where: { userId: user.id } })).toBe(0);
    await page.unroute('**/api/collection/*/buy');

    // коллекция не загрузилась → ошибка и «Повторить»
    await page.route('**/api/collection', (route) => route.abort());
    await page.reload();
    await page.getByTestId('nav-shop').click();
    await expect(page.getByTestId('collection-loading')).toBeVisible();
    await expect(page.getByTestId('collection-error')).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/collection');
    await page.getByTestId('collection-retry').click();
    await expect(page.getByTestId('cosmetic-pink_angel')).toHaveAttribute('data-state', 'available');
  });
});
