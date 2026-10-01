import { expect, test } from '@playwright/test';

test.describe('Office', () => {
  test('tapping earns coins, spends energy and survives a reload', async ({ page }) => {
    await page.goto('/?uid=700000201&name=Тапер');
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('energy-value')).toHaveText('1000 / 1000');

    const cat = page.getByTestId('cat-button');
    const box = (await cat.boundingBox())!;
    for (let i = 0; i < 15; i++) {
      await page.mouse.click(box.x + box.width / 2 + (i % 5) * 6, box.y + box.height / 2 - (i % 3) * 6);
    }
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '15');
    await expect(page.getByTestId('energy-value')).toHaveText(/^98[5-9] \/ 1000$/);

    // ждём синхронизацию пачки и перезагружаем — монеты сохранены на сервере
    await page.waitForResponse((r) => r.url().includes('/api/tap') && r.ok(), { timeout: 8000 });
    await page.reload();
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '15');
  });

  test('shows stats, league and the per-hour hint', async ({ page }) => {
    await page.goto('/?uid=700000202&name=Мурка');
    await expect(page.getByTestId('stat-per-tap')).toHaveText('+1');
    await expect(page.getByTestId('stat-to-level')).toHaveText('5K');
    await expect(page.getByTestId('league-name')).toContainText('Bronze');
    await expect(page.getByTestId('league-level')).toHaveText('Level 1/10');
    await page.getByRole('button', { name: 'info' }).click();
    await expect(page.getByTestId('per-hour-hint')).toContainText('3');
  });
});
