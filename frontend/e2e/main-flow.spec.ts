import { expect, test } from '@playwright/test';
import { markLeagueSeen, setPlayer } from './db';

/** Главный сценарий из ТЗ: вход → тап → покупка карточки → ежедневка → приглашение друга. */
test('main flow: login, tap, buy a card, claim the daily reward, invite a friend', async ({ page }) => {
  const uid = 700000990;
  await page.goto(`/?uid=${uid}&name=Игрок`);
  await expect(page.getByTestId('office')).toBeVisible();

  const cat = (await page.getByTestId('tap-button').boundingBox())!;
  for (let i = 0; i < 10; i++) await page.mouse.click(cat.x + cat.width / 2, cat.y + cat.height / 2);
  await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '10');
  await page.waitForResponse((r) => r.url().includes('/api/tap') && r.ok(), { timeout: 8000 });

  await setPlayer(uid, { balance: 1_010, totalEarned: 1_010 });
  await page.reload();
  await page.getByTestId('open-mine').click();
  await page.getByTestId('card-mk_spot').click();
  await page.getByTestId('card-buy').click();
  await expect(page.getByTestId('card-mk_spot').getByTestId('card-level')).toHaveAttribute(
    'aria-label',
    'lvl 1',
  );

  await page.keyboard.press('Escape'); // из Mine — на главную
  await page.getByTestId('open-earn').click();
  await page.getByTestId('daily-row').click();
  await page.getByTestId('daily-claim').click();
  await expect(page.getByTestId('daily-day-1')).toHaveAttribute('data-state', 'claimed');
  await page.keyboard.press('Escape');

  await markLeagueSeen(page, uid, 9);
  await page.goto(`/?uid=700000991&name=Новичок&ref=ref_${uid}`);
  await expect(page.getByText('Вас пригласил(а) Игрок: +5 000 монет!')).toBeVisible();

  await page.goto(`/?uid=${uid}&name=Игрок`);
  await page.getByTestId('nav-friends').click();
  await expect(page.getByTestId('friend-row')).toContainText('Новичок');
  await page.getByTestId('nav-office').click();
  // 1 010 − 800 (карточка) + 500 (День 1) + 5 000 + 20 000 (друг и его Silver) + пассивный доход
  // + достижения: первая карточка 1 000, первый друг 5 000, лиги Silver 2 000 и Gold 5 000
  await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^38\s7\d\d$/);
});
