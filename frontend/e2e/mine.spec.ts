import { expect, test } from '@playwright/test';
import { db, markLeagueSeen, setPlayer } from './db';

async function userId(telegramId: number): Promise<number> {
  return (await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(telegramId) } })).id;
}

test.describe('Mine', () => {
  test('buying a card raises profit per hour and the card level', async ({ page }) => {
    const uid = 700000501;
    await page.goto(`/?uid=${uid}&name=Инвестор`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { balance: 10_000, totalEarned: 10_000, leagueLevel: 1 });
    await markLeagueSeen(page, uid, 1);
    await page.reload();

    await page.getByTestId('nav-mine').click();
    await expect(page.getByTestId('mine')).toBeVisible();
    const tile = page.getByTestId('card-mk_spot');
    await expect(tile).toContainText('Спот-торговля');
    await expect(tile.getByTestId('card-level')).toHaveAttribute('aria-label', 'lvl 0');
    await tile.click();

    const sheet = page.getByTestId('card-sheet');
    await expect(sheet).toContainText('Покупай дёшево');
    await expect(sheet.getByTestId('sheet-price')).toContainText('800');
    await sheet.getByTestId('card-buy').click();
    await expect(sheet.getByRole('dialog')).toBeHidden();
    await expect(page.getByTestId('per-hour-float')).toBeVisible();
    await expect(tile.getByTestId('card-level')).toHaveAttribute('aria-label', 'lvl 1');
    await expect(page.getByTestId('mine-stat-per-hour')).toHaveText('+198');

    // прибыль в час видна и в офисе
    await page.getByTestId('nav-office').click();
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('stat-per-hour')).toHaveText('+198');
  });

  test('locked cards show their condition; not enough coins disables the button', async ({ page }) => {
    const uid = 700000502;
    await page.goto(`/?uid=${uid}&name=Новичок`);
    await page.getByTestId('nav-mine').click();
    const locked = page.getByTestId('card-mk_margin20');
    await expect(locked).toHaveAttribute('data-locked', 'true');
    await expect(locked.getByTestId('card-lock')).toHaveText('«Маржа x10» ур. 5');
    await locked.click();
    await expect(page.getByTestId('card-buy')).toBeDisabled();
    await expect(page.getByTestId('card-buy')).toHaveText('Нужна карточка «Маржа x10» ур. 5');
    await page.keyboard.press('Escape');

    await page.getByTestId('card-mk_spot').click();
    await expect(page.getByTestId('card-buy')).toHaveText('Недостаточно монет');
    await expect(page.getByTestId('card-buy')).toBeDisabled();
  });

  test('categories and specials sub-tabs', async ({ page }) => {
    const uid = 700000503;
    await page.goto(`/?uid=${uid}&name=Коллекционер`);
    await page.getByTestId('nav-mine').click();
    await page.getByTestId('mine-cat-LEGAL').click();
    await expect(page.getByTestId('card-lg_kyc')).toBeVisible();
    await expect(page.getByTestId('card-mk_spot')).toHaveCount(0);

    await page.getByTestId('mine-cat-SPECIALS').click();
    // особых карточек ещё нет — открываются «Новые»
    await expect(page.getByTestId('mine-specials-new')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('card-sp_ceo_photo')).toBeVisible();
    await expect(page.getByTestId('card-sp_laser').getByTestId('card-lock')).toHaveText('Пригласи 1 друга');
    await expect(page.locator('[data-testid="limited-timer"]')).toHaveCount(2);
    await page.getByTestId('mine-specials-mine').click();
    await expect(page.getByTestId('mine-empty')).toBeVisible();
  });

  test('cooldown timer after buying an expensive card', async ({ page }) => {
    const uid = 700000504;
    await page.goto(`/?uid=${uid}&name=Хедж`);
    await expect(page.getByTestId('office')).toBeVisible();
    const id = await userId(uid);
    await db.userCard.upsert({
      where: { userId_cardId: { userId: id, cardId: 'mk_insurance_fund' } },
      create: { userId: id, cardId: 'mk_insurance_fund', level: 1 },
      update: { level: 1, cooldownUntil: null },
    });
    await setPlayer(uid, { balance: 50_000_000, totalEarned: 50_000_000, leagueLevel: 7 });
    await markLeagueSeen(page, uid, 7);
    await page.reload();
    await page.getByTestId('nav-mine').click();
    const tile = page.getByTestId('card-mk_insurance_fund');
    await tile.click();
    await page.getByTestId('card-buy').click();
    await expect(tile.getByTestId('cooldown')).toBeVisible();
    await expect(tile.getByTestId('cooldown')).toContainText(/00:1[45]:\d\d/);
    await tile.click();
    await expect(page.getByTestId('card-buy')).toHaveText(/Доступно через 00:1[45]:\d\d/);
  });

  test('offline income sheet after a long absence', async ({ page }) => {
    const uid = 700000505;
    await page.goto(`/?uid=${uid}&name=Отпускник`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { profitPerHour: 3600n, lastSyncAt: new Date(Date.now() - 5 * 3600_000) });
    // офлайн-доход 10 800 поднимет игрока в Silver — эту сцену проверяет leagues.spec
    await markLeagueSeen(page, uid, 1);
    await page.reload();
    const sheet = page.getByTestId('offline-sheet');
    await expect(sheet).toContainText('Пока вас не было');
    await expect(sheet.getByTestId('offline-amount')).toHaveText('+10 800');
    await expect(sheet).toContainText('максимум 3 часа');
    await sheet.getByTestId('offline-thanks').click();
    await expect(sheet.getByRole('dialog')).toBeHidden();
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^10\s8\d\d$/);
  });
});
