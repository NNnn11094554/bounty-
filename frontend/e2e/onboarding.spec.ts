import { expect, test } from '@playwright/test';

test.describe('Onboarding', () => {
  test('first login: three slides, then choosing HQ gives +5 000 and opens the office', async ({ page }) => {
    await page.goto('/?uid=700001101&name=Новенький&onboarding=1');
    const onboarding = page.getByTestId('onboarding');
    await expect(onboarding).toBeVisible();
    await expect(page.getByTestId('onboarding-slide-0')).toContainText('Тапай кота');
    const shots = process.env.SCREENSHOTS;
    if (shots) {
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${shots}/17-onboarding.png` });
    }
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-slide-1')).toContainText('Покупай карточки');
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-slide-2')).toContainText('+5 000');
    await expect(page.getByTestId('onboarding-next')).toHaveText('Выбрать штаб-квартиру');
    await page.getByTestId('onboarding-next').click();

    await expect(page.getByTestId('onboarding-hq')).toBeVisible();
    await expect(page.getByTestId('hq-confirm')).toBeDisabled();
    await page.getByTestId('hq-paw_city').click();
    await expect(page.getByTestId('hq-paw_city')).toHaveAttribute('aria-checked', 'true');
    if (shots) await page.screenshot({ path: `${shots}/18-hq.png` });
    await page.getByTestId('hq-confirm').click();

    await expect(onboarding).toBeHidden();
    await expect(page.getByText('Добро пожаловать в Лапа-Сити!')).toBeVisible();
    await expect(page.getByTestId('player-hq')).toHaveText('CEO · Лапа-Сити');
    if (shots) {
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${shots}/19-office-hq.png` });
    }
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^5\s000$/);

    // второй вход — без онбординга
    await page.reload();
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(onboarding).toHaveCount(0);
  });

  test('skip goes straight to the headquarters choice', async ({ page }) => {
    await page.goto('/?uid=700001102&name=Торопыга&onboarding=1');
    await page.getByTestId('onboarding-skip').click();
    await expect(page.getByTestId('hq-picker')).toBeVisible();
    await expect(page.getByTestId('hq-picker').getByRole('radio')).toHaveCount(6);
  });
});
