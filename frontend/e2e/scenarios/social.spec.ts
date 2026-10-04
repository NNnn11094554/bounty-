import { expect, test } from './fixtures';

/** Друзья: приглашение по ссылке — бонус обоим, друг в списке пригласившего, ссылка для приглашения. */
test.describe('Scenario: friends', () => {
  test('a friend joins by the invite link: both get the bonus, the friend shows up in the list', async ({
    game,
    page,
  }) => {
    const inviter = 710000501;
    await game.login(inviter, { name: 'Пригласивший Сценарий' });
    const inviterBefore = (await game.user()).balance.toNumber();
    await game.tab('friends');
    await expect(page.getByTestId('friends-count')).toContainText('(0)');

    // друг открывает игру по ссылке ref_<id>
    await game.login(710000502, { name: 'Друг Сценария', ref: inviter });
    await expect(page.getByText(/Вас пригласил\(а\) Пригласивший Сценарий/)).toBeVisible();
    await expect.poll(async () => (await game.user()).balance.toNumber()).toBeGreaterThanOrEqual(5_000);
    const leagueUp = page.getByTestId('league-up');
    if (await leagueUp.isVisible().catch(() => false)) await page.getByTestId('league-up-close').click();

    // пригласивший видит друга и свой бонус
    await game.login(inviter, { name: 'Пригласивший Сценарий' });
    expect((await game.user()).balance.toNumber()).toBeGreaterThanOrEqual(inviterBefore + 5_000);
    await game.tab('friends');
    await expect(page.getByTestId('friends-count')).toContainText('(1)');
    await expect(page.getByTestId('friend-row')).toContainText('Друг Сценария');
  });

  test('the invite link is copied with the player id', async ({ game, page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await game.login(710000503);
    await game.tab('friends');
    await page.getByTestId('friends-copy').click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(new RegExp(`\\?start=ref_${game.uid}$`));
  });
});
