import { expect, test } from '@playwright/test';
import { setPlayer } from './db';

/** Снимки экранов для визуальной проверки дизайна: SCREENSHOTS=<папка> npx playwright test screens */
const dir = process.env.SCREENSHOTS;
test.skip(!dir, 'только при SCREENSHOTS=<папка>');

test('capture main screens', async ({ page }) => {
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
  await page.reload();
  await expect(page.getByTestId('office')).toBeVisible();
  const cat = (await page.getByTestId('cat-button').boundingBox())!;
  for (let i = 0; i < 6; i++)
    await page.mouse.click(cat.x + cat.width * (0.35 + i * 0.06), cat.y + cat.height * 0.4);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/01-office.png` });
  await page.getByTestId('open-boosts').click();
  await expect(page.getByTestId('boosts')).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/02-boosts.png` });
  await page.getByTestId('boost-multitap').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dir}/03-boost-sheet.png` });
});
