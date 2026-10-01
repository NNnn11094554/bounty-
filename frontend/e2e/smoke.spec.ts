import { expect, test } from '@playwright/test';

test('player logs in and sees the home screen', async ({ page }) => {
  await page.goto('/?uid=700000101&name=Мурзик');
  await expect(page.getByTestId('home')).toBeVisible();
  await expect(page.getByText('Мурзик')).toBeVisible();
});
