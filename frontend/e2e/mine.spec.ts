import { expect, test } from '@playwright/test';
import { db, markLeagueSeen, setPlayer } from './db';

async function userId(telegramId: number): Promise<number> {
  return (await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(telegramId) } })).id;
}

test.describe('Assets (Mine)', () => {
  test('buying an asset raises profit per hour and the asset level', async ({ page }) => {
    const uid = 700000501;
    await page.goto(`/?uid=${uid}&name=Инвестор`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { balance: 10_000, totalEarned: 10_000, leagueLevel: 1 });
    await markLeagueSeen(page, uid, 1);
    await page.reload();

    await page.getByTestId('open-mine').click();
    await expect(page.getByTestId('mine')).toBeVisible();
    const tile = page.getByTestId('card-ton');
    await expect(tile).toContainText('Toncoin');
    await expect(tile.locator('[data-ticker]')).toHaveText('TON');
    await expect(tile.getByTestId('card-level')).toHaveAttribute('aria-label', 'lvl 0');
    await tile.click();

    const sheet = page.getByTestId('card-sheet');
    await expect(sheet).toContainText('Сеть, которая живёт прямо в мессенджере');
    await expect(sheet.getByTestId('sheet-rarity')).toHaveText('Обычный');
    await expect(sheet.getByTestId('sheet-level')).toContainText('0 / 25');
    await expect(sheet.getByTestId('sheet-price')).toContainText('600');
    await expect(sheet.getByTestId('sheet-profit')).toHaveText('+133');
    await expect(sheet.getByTestId('sheet-expected')).toContainText('133');
    await expect(sheet.getByTestId('sheet-payback')).toContainText('4,5 ч');
    await expect(sheet.getByTestId('asset-disclaimer')).toContainText('не настоящая криптовалюта');
    await sheet.getByTestId('card-buy').click();
    await expect(sheet.getByRole('dialog')).toBeHidden();
    await expect(page.getByTestId('mine').getByTestId('per-hour-float')).toBeVisible();
    await expect(tile.getByTestId('card-level')).toHaveAttribute('aria-label', 'lvl 1');
    await expect(page.getByTestId('mine-stat-per-hour')).toHaveText('+133');

    // прибыль в час видна и на главной («Назад» из активов)
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('stat-per-hour')).toHaveText('+133');
  });

  test('locked assets show their requirement; not enough coins disables the button', async ({ page }) => {
    const uid = 700000502;
    await page.goto(`/?uid=${uid}&name=Новичок`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { balance: 0 });
    await page.reload();
    await page.getByTestId('open-mine').click();
    const locked = page.getByTestId('card-trx');
    await expect(locked).toHaveAttribute('data-locked', 'true');
    await expect(locked.getByTestId('card-lock')).toHaveText('«Toncoin» ур. 3');
    await locked.click();
    await expect(page.getByTestId('card-buy')).toBeDisabled();
    await expect(page.getByTestId('card-buy')).toHaveText('Нужен актив «Toncoin» ур. 3');
    // цена открытия видна и у закрытого платного актива
    await expect(page.getByTestId('sheet-stars')).toHaveText(/\d+/);
    await page.keyboard.press('Escape');

    await page.getByTestId('card-ton').click();
    await expect(page.getByTestId('card-buy')).toHaveText('Недостаточно монет');
    await expect(page.getByTestId('card-buy')).toBeDisabled();
  });

  test('a Stars asset is unlocked with Stars and then upgraded with coins', async ({ page }) => {
    const uid = 700000506;
    await page.goto(`/?uid=${uid}&name=Холдер`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { balance: 1_000_000, totalEarned: 1_000_000, leagueLevel: 2 });
    await markLeagueSeen(page, uid, 2);
    await page.reload();
    await page.getByTestId('open-mine').click();
    // Litecoin: без условий, первый уровень — за Stars
    const tile = page.getByTestId('card-ltc');
    await expect(tile.getByTestId('card-stars')).toHaveText(/\d+/);
    const stars = Number(await tile.getAttribute('data-stars'));
    expect(stars).toBeGreaterThan(0);
    await tile.click();
    const sheet = page.getByTestId('card-sheet');
    await expect(sheet.getByTestId('card-buy')).toHaveCount(0);
    await expect(sheet.getByTestId('card-unlock')).toContainText(String(stars));
    await expect(sheet).toContainText('1-й уровень — за Telegram Stars');
    // счёт без Telegram (e2e) оплачивает тестовый сервер
    await sheet.getByTestId('card-unlock').click();
    await expect(sheet.getByRole('dialog')).toBeHidden();
    await expect(tile.getByTestId('card-level')).toHaveAttribute('aria-label', 'lvl 1');
    await expect(tile.getByTestId('card-stars')).toHaveCount(0);
    await expect(tile.getByTestId('card-price')).toBeVisible();
    const purchase = await db.purchase.findFirstOrThrow({ where: { productId: 'asset_ltc' } });
    expect(purchase).toMatchObject({ status: 'PAID', stars });

    // 2-й уровень — за монеты
    await tile.click();
    await sheet.getByTestId('card-buy').click();
    await expect(sheet.getByRole('dialog')).toBeHidden();
    await expect(tile.getByTestId('card-level')).toHaveAttribute('aria-label', 'lvl 2');
  });

  test('categories and specials sub-tabs', async ({ page }) => {
    const uid = 700000503;
    await page.goto(`/?uid=${uid}&name=Коллекционер`);
    await page.getByTestId('open-mine').click();
    await page.getByTestId('mine-cat-MEME').click();
    await expect(page.getByTestId('card-doge')).toBeVisible();
    await expect(page.getByTestId('card-ton')).toHaveCount(0);
    await page.getByTestId('mine-cat-DEFI').click();
    await expect(page.getByTestId('card-link')).toBeVisible();

    await page.getByTestId('mine-cat-SPECIALS').click();
    // особых активов ещё нет — открываются «Новые»
    await expect(page.getByTestId('mine-specials-new')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('card-in_gpu')).toBeVisible();
    await expect(page.getByTestId('card-in_dao').getByTestId('card-lock')).toHaveText('Пригласи 7 друзей');
    await expect(page.locator('[data-testid="limited-timer"]')).toHaveCount(2);
    await page.getByTestId('mine-specials-mine').click();
    await expect(page.getByTestId('mine-empty')).toBeVisible();
  });

  test('cooldown timer after upgrading an expensive asset', async ({ page }) => {
    const uid = 700000504;
    await page.goto(`/?uid=${uid}&name=Хедж`);
    await expect(page.getByTestId('office')).toBeVisible();
    const id = await userId(uid);
    await db.userCard.upsert({
      where: { userId_cardId: { userId: id, cardId: 'apt' } },
      create: { userId: id, cardId: 'apt', level: 1 },
      update: { level: 1, cooldownUntil: null },
    });
    await setPlayer(uid, { balance: 50_000_000, totalEarned: 50_000_000, leagueLevel: 7 });
    await markLeagueSeen(page, uid, 7);
    await page.reload();
    await page.getByTestId('open-mine').click();
    const tile = page.getByTestId('card-apt');
    await tile.click();
    await page.getByTestId('card-buy').click();
    await expect(tile.getByTestId('cooldown')).toBeVisible();
    await expect(tile.getByTestId('cooldown')).toContainText(/00:(59|60):\d\d|01:00:00/);
    await tile.click();
    await expect(page.getByTestId('card-buy')).toHaveText(/Доступно через (00:59|01:00):\d\d/);
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
    // 10 800 + достижения «Своё дело» (прибыль 1 000/ч) 10 000 и «Серебряный кот» 2 000
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^22\s8\d\d$/);
  });
});
