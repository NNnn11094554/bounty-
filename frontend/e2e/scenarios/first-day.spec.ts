import { expect, test } from './fixtures';

/**
 * Первый день игрока: обучение → стартовый бонус → тапы → первый актив → ежедневная награда → бесплатный
 * персонаж → профиль. Всё, что видно на экране, проверяется и на сервере.
 */
test.describe('Scenario: first day', () => {
  test('a new player goes from onboarding to the first asset, daily reward, a new character and the profile', async ({
    game,
    page,
  }) => {
    await game.login(710000001, { name: 'Новичок', onboarding: true });

    // обучение: три слайда, «Начать» даёт +5 000
    for (let i = 0; i < 2; i++) await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-next')).toContainText('5 000');
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('office')).toBeVisible();
    // 5 000 стартового бонуса — это уже лига Silver: достижение «Серебряный кот» +2 000 и сцена новой лиги
    await expect.poll(() => game.balance()).toBe(7_000);
    const leagueUp = page.getByTestId('league-up');
    if (await leagueUp.isVisible().catch(() => false)) await page.getByTestId('league-up-close').click();
    await expect(leagueUp).toHaveCount(0);

    // тапы: каждый — монета и единица энергии, сервер засчитывает все
    const [energyBefore] = await game.energy();
    const taps = await game.tap(20);
    await expect.poll(() => game.balance()).toBeGreaterThanOrEqual(7_000 + taps);
    const [energyAfter] = await game.energy();
    // энергия тратится (и понемногу восстанавливается на ходу — ~3 в секунду)
    expect(energyBefore - energyAfter).toBeGreaterThan(taps / 2);
    await game.serverTaps(taps);
    expect((await game.user()).balance.toNumber()).toBe(7_000 + taps);

    // первый актив: Toncoin за 600 даёт +133 в час
    await page.getByTestId('open-mine').click();
    await expect(page.getByTestId('mine')).toBeVisible();
    await page.getByTestId('card-ton').click();
    const sheet = page.getByTestId('card-sheet');
    await expect(sheet.getByTestId('sheet-price')).toContainText('600');
    await sheet.getByTestId('card-buy').click();
    await expect(page.getByTestId('card-ton').getByTestId('card-level')).toHaveAttribute(
      'aria-label',
      'lvl 1',
    );
    await game.back();
    await expect(page.getByTestId('mine')).toBeHidden();
    await expect(page.getByTestId('stat-per-hour')).toHaveText('+133');
    await expect.poll(async () => (await game.user()).profitPerHour).toBe(133n);

    // ежедневная награда: +500
    const beforeDaily = (await game.user()).balance.toNumber();
    await page.getByTestId('open-earn').click();
    await page.getByTestId('daily-row').click();
    await page.getByTestId('daily-claim').click();
    await expect(page.getByTestId('daily-claim')).toBeDisabled();
    await expect
      .poll(async () => (await game.user()).balance.toNumber())
      .toBeGreaterThanOrEqual(beforeDaily + 500);
    await game.back();
    await game.back();
    await expect(page.getByTestId('earn')).toBeHidden();

    // бесплатный персонаж: надевается с карточки — главный экран показывает его и его мир
    await game.tab('collection');
    await page.getByTestId('equip-desert_nomad').click();
    await expect(page.getByTestId('cosmetic-desert_nomad')).toHaveAttribute('data-state', 'equipped');
    await game.tab('office');
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'desert_nomad');
    await expect(page.getByTestId('skin-scene')).toHaveAttribute('data-scene-skin', 'desert_nomad');

    // профиль: статистика с сервера
    await game.tab('profile');
    await expect(page.getByTestId('stat-totalTaps')).toHaveText(String(taps));
    await expect(page.getByTestId('stat-cards')).toHaveText('1');

    // всё сохраняется после перезапуска
    await game.reload();
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'desert_nomad');
    await expect(page.getByTestId('stat-per-hour')).toHaveText('+133');
  });
});
