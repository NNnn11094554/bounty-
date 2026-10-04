import { db, expect, test } from './fixtures';

/** Магазин и коллекция: покупки за Telegram Stars, премиальный персонаж, закрытые персонажи, эффекты. */
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

  test('premium character for Stars: bought in the showcase, worn on the office, kept after a restart', async ({
    game,
    page,
  }) => {
    await game.login(710000402);
    await game.tab('shop');
    await page.getByTestId('cosmetic-angel_guardian').click();
    const modal = page.getByTestId('cosmetic-modal');
    await expect(modal.getByTestId('skin-preview')).toBeVisible();
    await expect(modal.getByTestId('cosmetic-price')).toContainText('149');
    await expect(modal.getByTestId('cosmetic-buy')).toContainText('149');
    await modal.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('toast-success')).toBeVisible();
    // купленный персонаж сразу надет
    await expect(modal.getByTestId('cosmetic-equipped')).toBeVisible();
    await game.back();
    await game.tab('office');
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'angel_guardian');
    const user = await game.user();
    expect(user.equippedSkinId).toBe('angel_guardian');
    expect(
      await db.purchase.count({
        where: { userId: user.id, productId: 'skin_angel_guardian', status: 'PAID' },
      }),
    ).toBe(1);
    await game.reload();
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'angel_guardian');
  });

  test('locked characters: a league reward cannot be bought or worn before its league', async ({
    game,
    page,
  }) => {
    await game.login(710000403, { state: { leagueLevel: 0 } });
    await game.tab('collection');
    const card = page.getByTestId('cosmetic-astro_cat');
    await expect(card).toHaveAttribute('data-state', 'locked');
    await card.click();
    const modal = page.getByTestId('cosmetic-modal');
    await expect(modal.getByTestId('skin-lock')).toContainText('Silver');
    await expect(modal.getByTestId('cosmetic-locked')).toBeDisabled();
    await expect(modal.getByTestId('cosmetic-buy')).toHaveCount(0);
    await game.back();
    await expect(page.getByTestId('cosmetic-modal').getByRole('dialog')).toBeHidden();
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
