import { expect, test } from './fixtures';

/** Тап-механика: касания как на телефоне (несколько пальцев), энергия, Turbo, плохая сеть, перезапуск. */
test.describe('Scenario: tap mechanics', () => {
  test('every touch counts: three fingers at once give three taps, on screen and on the server', async ({
    game,
  }) => {
    await game.login(710000101, { state: { energy: 5000, energyUpdatedAt: new Date() } });
    const balance = await game.balance();
    const taps = await game.tap(10, { fingers: 3, gapMs: 120 });
    expect(taps).toBe(30);
    await expect.poll(() => game.balance()).toBeGreaterThanOrEqual(balance + 30);
    await game.serverTaps(30);
    const user = await game.user();
    expect(user.suspiciousScore).toBe(0);
  });

  test('out of energy: taps give nothing and the energy comes back by itself', async ({ game, page }) => {
    await game.login(710000102, { state: { energy: 4, energyUpdatedAt: new Date() } });
    // касаний заметно больше, чем энергии: за время перезагрузки и серии она успевает восстановиться (~3 в
    // секунду), поэтому запас — чтобы проверка не зависела от доли секунды
    await game.tap(20, { gapMs: 30 });
    await expect.poll(async () => (await game.energy())[0]).toBeLessThan(4);
    // засчитано не больше, чем было энергии (+ то, что успело восстановиться)
    await page.waitForTimeout(3500);
    const taps = Number((await game.user()).totalTaps);
    expect(taps).toBeGreaterThanOrEqual(4);
    expect(taps).toBeLessThan(20);
    // энергия восстанавливается
    const [low] = await game.energy();
    await expect.poll(async () => (await game.energy())[0], { timeout: 8000 }).toBeGreaterThan(low);
  });

  test('Turbo: for a minute every tap is worth ×5 and spends no energy', async ({ game, page }) => {
    await game.login(710000103, { state: { energy: 3000, energyUpdatedAt: new Date() } });
    await page.getByTestId('open-boosts').click();
    await expect(page.getByTestId('boost-turbo')).toContainText('3/3');
    await page.getByTestId('boost-turbo').click();
    await expect(page.getByTestId('boost-sheet')).toContainText('60');
    await page.getByTestId('boost-confirm').click();
    await expect(page.getByTestId('boosts')).toBeHidden();
    await expect(page.getByTestId('hero')).toHaveAttribute('data-turbo', 'true');

    const user = await game.user();
    expect(user.turboUntil!.getTime() - Date.now()).toBeGreaterThan(50_000);
    const balance = user.balance.toNumber();
    const [energy] = await game.energy();
    await game.tap(10);
    await game.serverTaps(10);
    expect((await game.user()).balance.toNumber()).toBe(balance + 50);
    const [energyAfter] = await game.energy();
    expect(energyAfter).toBeGreaterThanOrEqual(energy);
  });

  test('bad network: taps made offline are kept and all reach the server once it is back, nobody is flagged', async ({
    game,
    page,
  }) => {
    await game.login(710000104, { state: { energy: 5000, energyUpdatedAt: new Date() } });
    const balance = await game.balance();
    await game.tap(10);
    // связь пропала, пока пачка была в пути
    await page.context().setOffline(true);
    await page.waitForTimeout(3000);
    // без связи — серия четырьмя пальцами
    const offline = await game.tap(40, { fingers: 4, gapMs: 40 });
    // на экране тапы уже есть
    await expect.poll(() => game.balance()).toBeGreaterThanOrEqual(balance + 10 + offline);
    await page.context().setOffline(false);
    // связь вернулась: сервер засчитывает все тапы — пачками не больше, чем принимает за это время
    await game.serverTaps(10 + offline, 40_000);
    const user = await game.user();
    expect(user.suspiciousScore).toBe(0);
    expect(user.balance.toNumber()).toBe(balance + 10 + offline);
    // и баланс на экране не откатился
    expect(await game.balance()).toBeGreaterThanOrEqual(balance + 10 + offline);
  });

  test('closing the game mid-tapping loses nothing and counts nothing twice', async ({ game, page }) => {
    await game.login(710000105, { state: { energy: 5000, energyUpdatedAt: new Date() } });
    await game.tap(25, { gapMs: 20 });
    await page.reload(); // сразу, пока пачка, возможно, ещё не ушла
    await expect(page.getByTestId('office')).toBeVisible();
    await game.serverTaps(25);
    await page.waitForTimeout(3000);
    expect(Number((await game.user()).totalTaps)).toBe(25);
  });

  test('a tap through an open sheet does not count', async ({ game, page }) => {
    await game.login(710000106, { state: { energy: 5000, energyUpdatedAt: new Date() } });
    const before = Number((await game.user()).totalTaps);
    await page.getByTestId('open-boosts').click();
    await page.getByTestId('boost-turbo').click();
    await expect(page.getByTestId('boost-sheet')).toBeVisible();
    await game.tap(6).catch(() => undefined); // экран бустов и окно закрывают персонажа
    await game.back();
    await game.back();
    await page.waitForTimeout(3500);
    expect(Number((await game.user()).totalTaps)).toBe(before);
  });
});
