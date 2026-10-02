import { expect, test } from '@playwright/test';
import { db, markLeagueSeen, setPlayer } from './db';

const RAW_ADDRESS = '0:83dfd552e63729b472fcbcc8c45ebcc6691702558b68ec7527e1ba403a0f31a8';

test.describe('Airdrop (TON wallet hidden by TON_WALLET_ENABLED = false)', () => {
  test('points, rank and requirements; no wallet connection anywhere', async ({ page }) => {
    const uid = 700001001;
    const wallet: string[] = [];
    page.on('request', (req) => {
      if (/tonconnect|WalletCard/i.test(req.url())) wallet.push(req.url());
    });
    await page.goto(`/?uid=${uid}&name=Холдер`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { totalEarned: 123_456, leagueLevel: 3, bestDailyStreak: 8 });
    await markLeagueSeen(page, uid, 9);
    await page.reload();
    await page.getByTestId('nav-airdrop').click();

    const airdrop = page.getByTestId('airdrop');
    await expect(airdrop).toContainText('Листинг уже в пути');
    // очки = всё заработанное (сверху могут прийти награды за достижения)
    await expect(page.getByTestId('airdrop-points')).toHaveText(/^\d{3}\s\d{3}$/);
    const points = Number((await page.getByTestId('airdrop-points').innerText()).replace(/\s/g, ''));
    expect(points).toBeGreaterThanOrEqual(123_456);
    await expect(page.getByTestId('airdrop-rank')).toHaveText(/^#\d+/);
    await expect(page.getByTestId('airdrop-req-league')).toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('airdrop-req-streak')).toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('airdrop-req-friends')).toHaveAttribute('data-done', 'false');
    await expect(page.getByTestId('airdrop-req-friends')).toContainText('0/3');
    await expect(page.getByTestId('airdrop-progress')).toHaveText('33%');
    await expect(page.getByTestId('airdrop-wallet-soon')).toContainText('Скоро');
    await expect(page.getByTestId('airdrop-soon')).toBeVisible();
    await expect(page.getByTestId('wallet-card')).toHaveCount(0);
    await expect(page.getByTestId('wallet-connect')).toHaveCount(0);
    await expect(page.getByText(/кошел[её]к TON/i)).toHaveCount(0);

    // в заданиях тоже нет «Подключи кошелёк»
    await page.getByTestId('nav-earn').click();
    await expect(page.getByTestId('earn')).toBeVisible();
    await expect(page.getByTestId('tasks-skeleton')).toHaveCount(0);
    await expect(page.getByText(/кошел[её]к TON/i)).toHaveCount(0);
    // библиотека TON Connect и её манифест не загружались
    expect(wallet).toEqual([]);
  });

  test('an already linked wallet stays in the database but is not shown', async ({ page }) => {
    const uid = 700001002;
    await page.goto(`/?uid=${uid}&name=Кошелёк`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { walletAddress: RAW_ADDRESS, walletConnectedAt: new Date() });
    await markLeagueSeen(page, uid, 9);
    await page.reload();
    await page.getByTestId('nav-airdrop').click();
    await expect(page.getByTestId('airdrop-points')).toBeVisible();
    await expect(page.getByTestId('wallet-address')).toHaveCount(0);
    await expect(page.getByTestId('airdrop-wallet-soon')).toBeVisible();
    const user = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
    expect(user.walletAddress).toBe(RAW_ADDRESS);
  });

  test('loading error shows a retry', async ({ page }) => {
    await page.route('**/api/airdrop', (route) => route.abort());
    await page.goto('/?uid=700001003&name=Сеть');
    await page.getByTestId('nav-airdrop').click();
    // GET повторяется при сетевой ошибке (≈15 с), потом — ошибка и «Повторить»
    await expect(page.getByTestId('airdrop-loading')).toBeVisible();
    await expect(page.getByTestId('airdrop-error')).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/airdrop');
    await page.getByTestId('airdrop-retry').click();
    await expect(page.getByTestId('airdrop-points')).toBeVisible();
  });
});
