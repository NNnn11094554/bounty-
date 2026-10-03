import { expect, test } from '@playwright/test';

test.describe('Onboarding', () => {
  test('first login: three slides, then «Start» gives +5 000 and opens the office', async ({ page }) => {
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
    await expect(page.getByTestId('onboarding-slide-1')).toContainText('Собирай крипто-активы');
    await page.getByTestId('onboarding-next').click();
    await expect(page.getByTestId('onboarding-slide-2')).toContainText('+5 000');
    // штаб-квартир больше нет: последний слайд сразу открывает игру со стартовым бонусом
    await expect(page.getByTestId('onboarding-next')).toHaveText('Начать · +5 000');
    await page.getByTestId('onboarding-next').click();

    await expect(onboarding).toBeHidden();
    await expect(page.getByText('Стартовый бонус +5 000!')).toBeVisible();
    await expect(page.getByTestId('player-hq')).toHaveCount(0);
    // 5 000 стартового бонуса + достижение «Серебряный кот» 2 000 (5 000 заработано — лига Silver)
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^7\s000$/);

    // второй вход — без онбординга
    await page.reload();
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(onboarding).toHaveCount(0);
  });

  test('skip opens the office right away with the start bonus', async ({ page }) => {
    await page.goto('/?uid=700001102&name=Торопыга&onboarding=1');
    await page.getByTestId('onboarding-skip').click();
    await expect(page.getByTestId('onboarding')).toBeHidden();
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^7\s000$/);
  });
});
