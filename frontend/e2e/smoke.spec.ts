import { expect, test } from '@playwright/test';

test('player logs in and sees the office', async ({ page }) => {
  await page.goto('/?uid=700000101&name=Мурзик');
  await expect(page.getByTestId('office')).toBeVisible();
  await expect(page.getByTestId('player-name')).toHaveText('Мурзик');
});

for (const width of [320, 375, 390, 430]) {
  test(`office fits ${width}px without horizontal scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 780 });
    await page.goto(`/?uid=70000011${width % 7}&name=Кот`);
    await expect(page.getByTestId('cat-button')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const cat = (await page.getByTestId('cat-button').boundingBox())!;
    const energy = (await page.getByTestId('energy').boundingBox())!;
    expect(cat.y + cat.height).toBeLessThanOrEqual(energy.y + 4);
    expect(energy.y + energy.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) + 1);
    if (process.env.SCREENSHOTS)
      await page.screenshot({ path: `${process.env.SCREENSHOTS}/office-${width}.png` });
  });
}
