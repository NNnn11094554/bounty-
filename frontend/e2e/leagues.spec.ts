import { expect, test } from '@playwright/test';
import { setPlayer } from './db';

test.describe('Leagues', () => {
  test('league screen: carousel, leaderboard and my place', async ({ page }) => {
    const uid = 700000601;
    await page.goto(`/?uid=${uid}&name=Лидер`);
    await expect(page.getByTestId('office')).toBeVisible();
    await page.getByTestId('league-name').click();

    const screen = page.getByTestId('leagues');
    await expect(screen).toBeVisible();
    const current = page.getByTestId('league-current');
    await expect(current).toHaveAttribute('aria-label', 'Bronze');
    await expect(current).toContainText('от 0');
    await expect(page.getByTestId('league-prev')).toBeDisabled();
    await expect(page.getByTestId('leader-me')).toContainText('Лидер (Вы)');
    await expect(page.getByTestId('my-rank')).not.toHaveText('—');
    await expect(page.getByTestId('league-progress')).toBeAttached();
    if (process.env.SCREENSHOTS) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${process.env.SCREENSHOTS}/09-leagues.png` });
    }

    await page.getByTestId('league-next').click();
    await expect(current).toHaveAttribute('aria-label', 'Silver');
    await expect(current).toHaveAttribute('data-from', '5K');
    await expect(page.getByTestId('league-to-reach')).toHaveText('5K');

    for (let i = 0; i < 8; i++) await page.getByTestId('league-next').click();
    await expect(current).toHaveAttribute('aria-label', 'Lord');
    await expect(page.getByTestId('league-next')).toBeDisabled();

    await page.keyboard.press('Escape');
    await expect(screen).toBeHidden();
    await expect(page.getByTestId('office')).toBeVisible();
  });

  test('crossing a threshold shows the new league scene', async ({ page }) => {
    const uid = 700000602;
    await page.goto(`/?uid=${uid}&name=Растущий`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { balance: 4_990, totalEarned: 4_990 });
    await page.reload();
    await expect(page.getByTestId('league-name')).toContainText('Bronze');

    const box = (await page.getByTestId('tap-button').boundingBox())!;
    for (let i = 0; i < 15; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

    const scene = page.getByTestId('league-up');
    await expect(scene).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('league-up-name')).toHaveAttribute('aria-label', 'Silver');
    if (process.env.SCREENSHOTS) {
      await page.waitForTimeout(1600);
      await page.screenshot({ path: `${process.env.SCREENSHOTS}/10-league-up.png` });
    }
    await page.getByTestId('league-up-close').click();
    await expect(scene).toBeHidden();
    await expect(page.getByTestId('league-name')).toContainText('Silver');

    // повторный вход — сцена уже просмотрена
    await page.reload();
    await expect(page.getByTestId('office')).toBeVisible();
    await page.waitForTimeout(800);
    await expect(scene).toHaveCount(0);
  });
});
