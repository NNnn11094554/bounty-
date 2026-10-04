import { expect, test } from './fixtures';

/** Прогресс: тапы поднимают лигу (сцена новой лиги), рейтинг лиги, уровень игрока. */
test.describe('Scenario: progress', () => {
  test('taps lift the player to a new league: the scene shows it once, the worn character stays', async ({
    game,
    page,
  }) => {
    // до Silver (5 000 заработано) не хватает 10 монет
    await game.login(710000201, {
      state: { balance: 4_990, totalEarned: 4_990, energy: 5000, energyUpdatedAt: new Date() },
    });
    await expect(page.getByTestId('league-name')).toContainText('Bronze');
    await game.tap(15);
    const scene = page.getByTestId('league-up');
    await expect(scene).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('league-up-name')).toHaveAttribute('aria-label', 'Silver');
    // персонажей-наград за лиги сейчас нет: все персонажи бесплатные
    await expect(page.getByTestId('league-up-reward')).toHaveCount(0);
    await page.getByTestId('league-up-close').click();
    await expect(scene).toHaveCount(0);
    await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', 'cyber_samurai');
    await expect(page.getByTestId('league-name')).toContainText('Silver');
    await expect.poll(async () => (await game.user()).leagueLevel).toBe(1);
    expect((await game.user()).equippedSkinId).toBe('cyber_samurai');
    // сцена показывается один раз
    await game.reload();
    await expect(scene).toHaveCount(0);
  });

  test('the league screen shows the player in the league top and the way to the next league', async ({
    game,
    page,
  }) => {
    await game.login(710000202, {
      name: 'Лидер Сценария',
      state: { balance: 60_000, totalEarned: 60_000, leagueLevel: 1 },
    });
    await page.getByTestId('league-name').click();
    await expect(page.getByTestId('leagues')).toBeVisible();
    await expect(page.getByTestId('league-current')).toBeVisible();
    await expect(page.getByTestId('leaderboard')).toContainText('Лидер Сценария');
    await game.back();
    await expect(page.getByTestId('leagues')).toBeHidden();
  });

  test('player level grows with earned coins and is shown on the office and in the profile', async ({
    game,
    page,
  }) => {
    await game.login(710000203, { state: { balance: 900_000, totalEarned: 900_000, leagueLevel: 2 } });
    const level = await page.getByTestId('player-level').textContent();
    expect(level).toMatch(/\d/);
    await game.tab('profile');
    await expect(page.getByTestId('profile-level-value')).toContainText(level!.replace(/\D/g, ''));
  });
});
