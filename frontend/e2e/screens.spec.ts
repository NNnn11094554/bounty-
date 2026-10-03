import { expect, test } from '@playwright/test';
import { markLeagueSeen, setPlayer } from './db';

/** Снимки экранов для визуальной проверки дизайна: SCREENSHOTS=<папка> npx playwright test screens */
const dir = process.env.SCREENSHOTS;
test.skip(!dir, 'только при SCREENSHOTS=<папка>');

test('capture main screens', async ({ page }) => {
  // много снимков подряд — больше времени, чем обычному сценарию
  test.setTimeout(240_000);
  const uid = 700000901;
  await page.goto(`/?uid=${uid}&name=Мурка`);
  await expect(page.getByTestId('office')).toBeVisible();
  await setPlayer(uid, {
    balance: 44_739_415,
    totalEarned: 60_000_000,
    leagueLevel: 7,
    multitapLevel: 17,
    energyLimitLevel: 16,
    profitPerHour: 767_200n,
  });
  await markLeagueSeen(page, uid, 7);
  await page.reload();
  await expect(page.getByTestId('office')).toBeVisible();
  const cat = (await page.getByTestId('cat-hit').boundingBox())!;
  for (let i = 0; i < 6; i++)
    await page.mouse.click(cat.x + cat.width * (0.35 + i * 0.06), cat.y + cat.height * 0.4);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/01-office.png` });
  await page.getByTestId('cipher-enter').click();
  const catBox = (await page.getByTestId('cat-hit').boundingBox())!;
  await page.mouse.move(catBox.x + catBox.width / 2, catBox.y + catBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.mouse.down();
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${dir}/01b-cipher.png` });
  await page.getByTestId('cipher-exit').click();
  await page.getByTestId('open-boosts').click();
  await expect(page.getByTestId('boosts')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/02-boosts.png` });
  await page.getByTestId('boost-multitap').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/03-boost-sheet.png` });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  await page.getByTestId('open-mine').click();
  await expect(page.getByTestId('card-ton')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/04-mine.png` });
  await page.getByTestId('card-ton').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/05-card-sheet.png` });
  await page.getByTestId('card-buy').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/06-card-bought.png` });
  await page.getByTestId('mine-cat-SPECIALS').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/07-specials.png` });
  await page.getByTestId('mine-cat-MEME').click();
  await page.getByTestId('mine-list').evaluate((el) => el.scrollTo(0, 1200));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/08-meme-locked.png` });

  await page.keyboard.press('Escape'); // из Mine — на главную
  await page.getByTestId('open-earn').click();
  await expect(page.getByTestId('daily-row')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/11-earn.png` });
  await page.getByTestId('daily-row').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dir}/12-daily.png` });
  await page.getByTestId('daily-claim').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/13-daily-claimed.png` });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape'); // из Earn — на главную

  await page.getByTestId('nav-friends').click();
  await expect(page.getByTestId('friends-count')).toBeVisible();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/14-friends.png` });
  await page.getByTestId('friends-more').click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/15-friend-bonuses.png` });
  await page.keyboard.press('Escape');

  await page.getByTestId('nav-airdrop').click();
  await expect(page.getByTestId('airdrop-points')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/16-airdrop.png` });
});
