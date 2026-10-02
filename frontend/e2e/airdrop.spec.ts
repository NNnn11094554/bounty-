import { expect, test } from '@playwright/test';
import { db, markLeagueSeen, setPlayer } from './db';

const RAW_ADDRESS = '0:83dfd552e63729b472fcbcc8c45ebcc6691702558b68ec7527e1ba403a0f31a8';

test.describe('Airdrop', () => {
  test('shows the wallet task with the connect button', async ({ page }) => {
    await page.goto('/?uid=700001001&name=Холдер');
    await page.getByTestId('nav-airdrop').click();
    await expect(page.getByTestId('airdrop')).toContainText('Задания Airdrop');
    await expect(page.getByTestId('airdrop')).toContainText('Листинг уже в пути');
    await expect(page.getByTestId('wallet-card')).toContainText('Подключи свой кошелёк TON');
    await expect(page.getByTestId('wallet-connect')).toBeEnabled();
    await expect(page.getByTestId('airdrop-soon')).toBeVisible();
  });

  test('a connected wallet is shown and can be disconnected', async ({ page }) => {
    const uid = 700001002;
    await page.goto(`/?uid=${uid}&name=Кошелёк`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { walletAddress: RAW_ADDRESS, walletConnectedAt: new Date() });
    // достижение «Кошелёк на месте» (+10 000) поднимет в Silver — сцену лиги проверяет leagues.spec
    await markLeagueSeen(page, uid, 1);
    await page.reload();
    await page.getByTestId('nav-airdrop').click();
    await expect(page.getByTestId('wallet-address')).toContainText('Кошелёк подключён');
    await expect(page.getByTestId('wallet-address')).toContainText(/UQ\w\w…\w{4}/);

    await page.getByTestId('wallet-disconnect').click();
    await expect(page.getByText('Кошелёк отключён')).toBeVisible();
    await expect(page.getByTestId('wallet-connect')).toBeVisible();
    const user = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
    expect(user.walletAddress).toBeNull();
  });
});
