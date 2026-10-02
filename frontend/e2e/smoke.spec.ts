import { expect, test } from '@playwright/test';

test('player logs in and sees the office', async ({ page }) => {
  await page.goto('/?uid=700000101&name=Мурзик');
  await expect(page.getByTestId('office')).toBeVisible();
  await expect(page.getByTestId('player-name')).toHaveText('Мурзик');
});

const WIDTHS = [320, 360, 375, 390, 412, 430];
for (const [i, width] of WIDTHS.entries()) {
  test(`office fits ${width}px without horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 780 });
    await page.goto(`/?uid=70000011${i}&name=Кот`);
    await expect(page.getByTestId('cat-button')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const cat = (await page.getByTestId('cat-button').boundingBox())!;
    const energy = (await page.getByTestId('energy').boundingBox())!;
    expect(cat.y + cat.height).toBeLessThanOrEqual(energy.y + 4);
    expect(energy.y + energy.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) + 1);
    // быстрые кнопки и все 6 вкладок меню помещаются по ширине
    for (const id of ['open-mine', 'open-earn', 'open-boosts']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(width);
    }
    const tabs = page.getByTestId('bottom-nav').getByRole('button');
    await expect(tabs).toHaveCount(6);
    for (const b of await tabs.all()) {
      const box = (await b.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
    if (process.env.SCREENSHOTS)
      await page.screenshot({ path: `${process.env.SCREENSHOTS}/office-${width}.png` });
  });
}

for (const width of [320, 390]) {
  test(`mine fits ${width}px without horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 780 });
    await page.goto(`/?uid=70000012${width % 7}&name=Кот`);
    await page.getByTestId('open-mine').click();
    await expect(page.getByTestId('card-mk_spot')).toBeVisible();
    await page.getByTestId('mine-cat-SPECIALS').click();
    await expect(page.getByTestId('card-sp_ceo_photo')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const tile = (await page.getByTestId('card-sp_cardboard_hq').boundingBox())!;
    expect(tile.x + tile.width).toBeLessThanOrEqual(width);
    const list = (await page.getByTestId('mine-list').boundingBox())!;
    expect(list.y + list.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) + 1);
    if (process.env.SCREENSHOTS)
      await page.screenshot({ path: `${process.env.SCREENSHOTS}/mine-${width}.png` });
  });
}

test('cipher mode fits 320×568: the Morse line stays above the cat', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/?uid=700000130&name=Кот');
  await page.getByTestId('cipher-enter').click();
  await expect(page.getByTestId('morse-overlay')).toBeAttached();
  await page.waitForTimeout(500); // лига сворачивается, кот подстраивает размер
  const overlay = (await page.getByTestId('morse-overlay').boundingBox())!;
  const cat = (await page.getByTestId('cat-button').boundingBox())!;
  const energy = (await page.getByTestId('energy').boundingBox())!;
  expect(overlay.y + overlay.height).toBeLessThanOrEqual(cat.y + 2);
  expect(cat.y + cat.height).toBeLessThanOrEqual(energy.y + 4);
  if (process.env.SCREENSHOTS) await page.screenshot({ path: `${process.env.SCREENSHOTS}/cipher-320.png` });
});
