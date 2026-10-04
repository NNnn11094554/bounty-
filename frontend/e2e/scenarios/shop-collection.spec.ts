import { db, expect, test } from './fixtures';

/** Магазин и коллекция: покупки за Telegram Stars, премиальный эффект, бесплатные персонажи, эффекты за монеты. */
test.describe('Scenario: shop and collection', () => {
  test('Stars purchase: coins arrive after payment, the league does not move', async ({ game, page }) => {
    await game.login(710000401, { state: { leagueLevel: 0 } });
    const before = await game.user();
    await game.tab('shop');
    await page.getByTestId('shop-tabs-special').click();
    await page.getByTestId('buy-coins_small').click();
    await expect(page.getByTestId('toast-success')).toBeVisible();
    const after = await game.user();
    expect(after.balance.toNumber() - before.balance.toNumber()).toBeGreaterThanOrEqual(25_000);
    expect(after.totalEarned.toNumber() - before.totalEarned.toNumber()).toBeLessThan(25_000);
    expect(after.leagueLevel).toBe(0);
  });

  test('premium tap effect for Stars: bought in the showcase, equipped, kept after a restart', async ({
    game,
    page,
  }) => {
    await game.login(710000402);
    await game.tab('shop');
    await page.getByTestId('shop-tabs-cosmetics').click();
    await page.getByTestId('cosmetic-matrix').click();
    const modal = page.getByTestId('cosmetic-modal');
    await expect(modal.getByTestId('cosmetic-buy')).toContainText('99');
    await modal.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('toast-success')).toBeVisible();
    // купленный эффект сразу надет, персонаж не меняется
    await expect(modal.getByTestId('cosmetic-equipped')).toBeVisible();
    const user = await game.user();
    expect([user.equippedSkinId, user.equippedEffectId]).toEqual(['cyber_samurai', 'matrix']);
    expect(
      await db.purchase.count({ where: { userId: user.id, productId: 'effect_matrix', status: 'PAID' } }),
    ).toBe(1);
    await game.back();
    await game.reload();
    await game.tab('collection');
    await page.getByTestId('collection-tabs-effect').click();
    await expect(page.getByTestId('cosmetic-matrix')).toHaveAttribute('data-state', 'equipped');
  });

  test('characters: all three are free from the start — no locks or prices, worn from the showcase', async ({
    game,
    page,
  }) => {
    await game.login(710000403, { state: { leagueLevel: 0 } });
    await game.tab('collection');
    await expect(page.getByTestId('cosmetic-cyber_samurai')).toHaveAttribute('data-state', 'equipped');
    for (const id of ['galaxy_emperor', 'shadow_drifter'])
      await expect(page.getByTestId(`cosmetic-${id}`)).toHaveAttribute('data-state', 'owned');
    await page.getByTestId('cosmetic-galaxy_emperor').click();
    const modal = page.getByTestId('cosmetic-modal');
    await expect(modal.getByTestId('skin-preview')).toBeVisible();
    await expect(modal.getByTestId('skin-lock')).toHaveCount(0);
    await expect(modal.getByTestId('cosmetic-price')).toHaveCount(0);
    await expect(modal.getByTestId('cosmetic-buy')).toHaveCount(0);
    await modal.getByTestId('cosmetic-equip').click();
    await expect(modal.getByTestId('cosmetic-equipped')).toBeVisible();
    await game.back();
    await game.tab('office');
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'galaxy_emperor');
    expect((await game.user()).equippedSkinId).toBe('galaxy_emperor');
  });

  test('tap effect for coins: bought when level and coins allow, and used on the next tap', async ({
    game,
    page,
  }) => {
    await game.login(710000404, { state: { balance: 60_000, totalEarned: 52_000, leagueLevel: 1 } });
    await game.tab('collection');
    await page.getByTestId('collection-tabs-effect').click();
    await page.getByTestId('cosmetic-hearts').click();
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('toast-success')).toBeVisible();
    await expect.poll(async () => (await game.user()).equippedEffectId).toBe('hearts');
  });
});
