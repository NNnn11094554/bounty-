import { expect, test, type Tab } from './fixtures';

/** Навигация: все вкладки, экраны поверх вкладок, «Назад» Telegram по порядку, без наложения экранов. */
test.describe('Scenario: navigation', () => {
  test('every tab opens its screen, one screen at a time', async ({ game, page }) => {
    await game.login(710000601);
    const tabs: Tab[] = ['friends', 'shop', 'airdrop', 'collection', 'profile', 'office'];
    for (const tab of tabs) {
      await game.tab(tab);
      // старая вкладка исчезает сразу — два экрана одновременно не видны
      await expect(page.locator('[data-tab]')).toHaveCount(1);
      await expect(page.locator('[data-tab]')).toHaveAttribute('data-tab', tab);
    }
  });

  test('«Back» closes the sheet first, then the screen, and from any tab goes to the office', async ({
    game,
    page,
  }) => {
    await game.login(710000602, { state: { balance: 10_000, totalEarned: 10_000, leagueLevel: 1 } });
    // экран поверх вкладки и окно в нём
    await page.getByTestId('open-mine').click();
    await expect(page.getByTestId('mine')).toBeVisible();
    await page.getByTestId('card-ton').click();
    await expect(page.getByTestId('card-sheet').getByRole('dialog')).toBeVisible();
    await game.back();
    await expect(page.getByTestId('card-sheet').getByRole('dialog')).toBeHidden();
    await expect(page.getByTestId('mine')).toBeVisible();
    await game.back();
    await expect(page.getByTestId('mine')).toBeHidden();
    await expect(page.getByTestId('office')).toBeVisible();

    // вкладка → «Назад» → главная
    for (const tab of ['shop', 'friends', 'collection'] as const) {
      await game.tab(tab);
      await game.back();
      await expect(page.getByTestId('office')).toBeVisible();
    }

    // профиль → настройки → «Назад» → профиль → «Назад» → главная
    await game.tab('profile');
    await page.getByTestId('open-settings').click();
    await expect(page.getByTestId('settings')).toBeVisible();
    await game.back();
    await expect(page.getByTestId('settings')).toBeHidden();
    await expect(page.getByTestId('profile')).toBeVisible();
    await game.back();
    await expect(page.getByTestId('office')).toBeVisible();
  });

  test('the game does not drift sideways after visiting screens that slide in', async ({ game, page }) => {
    await game.login(710000603, { state: { balance: 10_000, totalEarned: 10_000, leagueLevel: 1 } });
    for (const open of ['open-mine', 'open-earn', 'open-boosts']) {
      await page.getByTestId(open).click();
      await page.waitForTimeout(150); // кликнуть, пока экран ещё въезжает
      await page.mouse.click(200, 300);
      await page.waitForTimeout(600);
      await game.back();
      await game.back();
    }
    const shifted = await page.evaluate(
      () => Array.from(document.querySelectorAll('*')).filter((el) => el.scrollLeft !== 0).length,
    );
    expect(shifted).toBe(0);
    await game.expectFitsScreen();
  });
});
