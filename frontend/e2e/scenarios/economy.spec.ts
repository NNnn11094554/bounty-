import { expect, setPlayer, markLeagueSeen, test } from './fixtures';

/** Экономика: активы и доход в час, пассивный доход, офлайн-доход при возвращении, Energy limit. */
test.describe('Scenario: economy', () => {
  test('assets: every level costs more and adds income; the balance grows by itself between taps', async ({
    game,
    page,
  }) => {
    await game.login(710000301, { state: { balance: 20_000, totalEarned: 20_000, leagueLevel: 1 } });
    await page.getByTestId('open-mine').click();
    const tile = page.getByTestId('card-ton');
    await tile.click();
    const sheet = page.getByTestId('card-sheet');
    await sheet.getByTestId('card-buy').click();
    await expect(tile.getByTestId('card-level')).toHaveAttribute('aria-label', 'lvl 1');
    // второй уровень дороже первого и добавляет доход
    await tile.click();
    const price2 = Number(((await sheet.getByTestId('sheet-price').textContent()) ?? '').replace(/\D/g, ''));
    expect(price2).toBeGreaterThan(600);
    const before = (await game.user()).balance.toNumber();
    await sheet.getByTestId('card-buy').click();
    await expect(tile.getByTestId('card-level')).toHaveAttribute('aria-label', 'lvl 2');
    const user = await game.user();
    expect(Number(user.profitPerHour)).toBeGreaterThan(133);
    expect(user.balance.toNumber()).toBeLessThanOrEqual(before - price2 + 5); // + пассивный доход за секунды
    await game.back();
    await expect(page.getByTestId('mine')).toBeHidden();

    // пассивный доход капает на экране и без тапов
    const a = await game.balance();
    await page.waitForTimeout(3000);
    expect(await game.balance()).toBeGreaterThanOrEqual(a);
  });

  test('coming back after hours away: offline income is shown and added, capped at 3 hours', async ({
    game,
    page,
  }) => {
    await game.login(710000302, { state: { leagueLevel: 2, totalEarned: 1_000_000, balance: 1_000_000 } });
    await setPlayer(game.uid, { profitPerHour: 3600n, lastSyncAt: new Date(Date.now() - 6 * 3600_000) });
    await markLeagueSeen(page, game.uid, 2);
    await page.reload();
    const sheet = page.getByTestId('offline-sheet');
    await expect(sheet).toContainText('Пока вас не было');
    await expect(sheet.getByTestId('offline-amount')).toHaveText('+10 800'); // 3 ч × 3 600, не 6 ч
    await sheet.getByTestId('offline-thanks').click();
    await expect.poll(async () => (await game.user()).balance.toNumber()).toBeGreaterThanOrEqual(1_010_800);
  });

  test('Energy limit: bought once, raises the energy cap for good', async ({ game, page }) => {
    await game.login(710000303, { state: { balance: 5_000, totalEarned: 5_000, leagueLevel: 1 } });
    const [, max] = await game.energy();
    await page.getByTestId('open-boosts').click();
    await expect(page.getByTestId('boost-multitap')).toHaveCount(0);
    await page.getByTestId('boost-energy-limit').click();
    await page.getByTestId('boost-confirm').click();
    await expect(page.getByTestId('boost-energy-limit')).toContainText('3 lvl');
    await game.back();
    await expect.poll(async () => (await game.energy())[1]).toBe(max + 500);
    await game.reload();
    expect((await game.energy())[1]).toBe(max + 500);
  });
});
