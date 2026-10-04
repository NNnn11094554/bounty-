import { expect, test, type Page } from '@playwright/test';
import { db, markLeagueSeen, setPlayer } from './db';

const HUMAN_TAP = { delay: 50 };

/** Игрок с заработанным (уровень) и балансом; сцена новой лиги не перекрывает сценарий. */
async function player(page: Page, uid: number, totalEarned: number, balance: number) {
  await page.goto(`/?uid=${uid}&name=Коллекционер`);
  await expect(page.getByTestId('office')).toBeVisible();
  await setPlayer(uid, { totalEarned, balance, leagueLevel: totalEarned >= 1_000_000 ? 2 : 1 });
  await markLeagueSeen(page, uid, 9);
  await page.reload();
  await expect(page.getByTestId('office')).toBeVisible();
  return db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
}

/** Баланс на экране числом. */
async function balanceOf(page: Page): Promise<number> {
  return Number(
    ((await page.getByTestId('balance-value').getAttribute('aria-label')) ?? '0').replace(/\D/g, ''),
  );
}

/** Главный экран показывает этого персонажа: сам персонаж, его картинка и его мир. */
async function expectCharacter(page: Page, id: string) {
  await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', id);
  await expect(page.locator('.hero-fig')).toHaveAttribute('data-figure-skin', id);
  await expect(page.locator('.hero-fig [data-skin-file="character"]')).toHaveAttribute(
    'style',
    new RegExp(`/assets/skins/${id}/character-\\d+\\.avif.*/assets/skins/${id}/character-\\d+\\.webp`),
  );
  await expect(page.getByTestId('skin-scene')).toHaveAttribute('data-scene-skin', id);
  await expect(page.locator('[data-testid="skin-scene"] [data-skin-file="background"]')).toHaveAttribute(
    'style',
    new RegExp(`/assets/skins/${id}/background-\\d+\\.webp`),
  );
  // файл не меньше места на экране (в пикселях экрана): браузер ничего не растягивает
  const fits = await page.evaluate(() =>
    [
      '.hero-fig [data-skin-file="character"]',
      '[data-testid="skin-scene"] [data-skin-file="background"]',
    ].map((sel) => {
      const el = document.querySelector<HTMLElement>(sel)!;
      const r = el.getBoundingClientRect();
      const size = Number(/-(\d+)\.webp/.exec(getComputedStyle(el).getPropertyValue('--img-webp'))![1]);
      const need = (sel.includes('character') ? r.height : r.width) * devicePixelRatio;
      // иначе — самый большой файл (экран крупнее, чем нужно игре)
      return size >= need || size === (sel.includes('character') ? 1600 : 3000);
    }),
  );
  expect(fits).toEqual([true, true]);
}

test.describe('Skins and collection', () => {
  test('free character: equipped without buying → it becomes the cat and its world, kept after reload, starter can be equipped back', async ({
    page,
  }) => {
    const uid = 700001601;
    const user = await player(page, uid, 52_000, 20_000); // лига Silver
    await expectCharacter(page, 'neon_punk');

    await page.getByTestId('nav-shop').click();
    await expect(page.getByTestId('shop-skins')).toBeVisible();
    // первые 3 — у всех, 4-й — награда за Silver, 5-й ждёт Gold, остальные — за звёзды
    await expect(page.getByTestId('cosmetic-neon_punk')).toHaveAttribute('data-state', 'equipped');
    await expect(page.getByTestId('cosmetic-desert_nomad')).toHaveAttribute('data-state', 'owned');
    await expect(page.getByTestId('cosmetic-sakura_blossom')).toHaveAttribute('data-state', 'owned');
    await expect(page.getByTestId('cosmetic-astro_cat')).toHaveAttribute('data-state', 'owned');
    await expect(page.getByTestId('cosmetic-mecha')).toHaveAttribute('data-state', 'locked');
    await expect(page.getByTestId('cosmetic-mecha')).toContainText('Лига Gold');
    await expect(page.getByTestId('cosmetic-forest_spirit')).toHaveAttribute('data-state', 'available');
    await expect(page.getByTestId('cosmetic-forest_spirit')).toContainText('199');
    // в коллекции только новые персонажи
    await expect(
      page.locator('[data-testid="shop-skins"] [data-testid^="cosmetic-"][data-state]'),
    ).toHaveCount(20);
    for (const old of ['black_crown', 'pink_angel', 'cyber', 'queen', 'diamond', 'legendary_crown']) {
      await expect(page.getByTestId(`cosmetic-${old}`)).toHaveCount(0);
    }

    await page.getByTestId('cosmetic-desert_nomad').click();
    await expect(page.getByTestId('cosmetic-modal')).toBeVisible();
    await expect(page.getByTestId('cosmetic-name')).toHaveText('Пустынный Странник');
    await expect(page.getByTestId('skin-how-to')).toContainText('Бесплатный');
    await expect(page.getByTestId('cosmetic-buy')).toHaveCount(0);
    await page.getByTestId('cosmetic-equip').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cosmetic-desert_nomad')).toHaveAttribute('data-state', 'equipped');

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.equippedSkinId).toBe('desert_nomad');
    // бесплатно: ничего не списано, в базе ничего не выдаётся
    expect(after.balance.toNumber()).toBeGreaterThanOrEqual(user.balance.toNumber());
    expect(await db.transaction.count({ where: { userId: user.id, type: 'cosmetic_purchase' } })).toBe(0);
    expect(await db.userCosmetic.count({ where: { userId: user.id } })).toBe(0);

    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'desert_nomad');
    // все картинки персонажа есть на сервере (каждый размер, AVIF и WebP)
    const sizes = {
      character: [600, 900, 1200, 1600],
      background: [1200, 1800, 2400, 3000],
      card: [480, 720, 960],
    };
    for (const [file, list] of Object.entries(sizes))
      for (const size of list)
        for (const ext of ['avif', 'webp']) {
          const res = await page.request.get(`/assets/skins/desert_nomad/${file}-${size}.${ext}`);
          expect(res.ok(), `${file}-${size}.${ext}`).toBe(true);
        }
    await page.reload();
    await expectCharacter(page, 'desert_nomad');

    // вкладка «Коллекция»: вернуть стартового кнопкой на карточке
    await page.getByTestId('nav-collection').click();
    await expect(page.getByTestId('collection')).toBeVisible();
    // 3 бесплатных + награда за Silver + эффект «монетки»
    await expect(page.getByTestId('collection-subtitle')).toContainText('открыто 5');
    await page.getByTestId('equip-neon_punk').click();
    await expect(page.getByTestId('cosmetic-neon_punk')).toHaveAttribute('data-state', 'equipped');
    await expect(page.getByTestId('cosmetic-desert_nomad')).toHaveAttribute('data-state', 'owned');
    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'neon_punk');
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).equippedSkinId).toBe('neon_punk');
  });

  test('full preview: big character in its world, rarity, description and how to get it', async ({
    page,
  }) => {
    await player(page, 700001607, 52_000, 0);
    await page.getByTestId('nav-collection').click();
    await page.getByTestId('cosmetic-galaxy_emperor').click();
    const sheet = page.getByTestId('cosmetic-sheet');
    await expect(sheet.getByTestId('skin-preview')).toBeVisible();
    await expect(sheet.locator('.hero-fig')).toHaveAttribute('data-figure-skin', 'galaxy_emperor');
    await expect(sheet.locator('.skin-scene')).toHaveAttribute('data-ambient', 'stars');
    await expect(sheet.locator('.skin-scene .amb').first()).toBeAttached();
    await expect(sheet.getByTestId('cosmetic-name')).toHaveText('Галактический Император');
    await expect(sheet).toContainText('Мифический');
    await expect(sheet.getByTestId('skin-how-to')).toContainText('399');
    await expect(page.getByTestId('cosmetic-buy')).toContainText('399');
    await page.keyboard.press('Escape');

    // бывший скин за монеты — теперь за звёзды, без условия по уровню
    await page.getByTestId('cosmetic-royal_emperor').click();
    await expect(sheet.getByTestId('skin-how-to')).toContainText('499');
    await expect(page.getByTestId('cosmetic-buy')).toContainText('499');
    await page.keyboard.press('Escape');

    // награда за лигу, лига ещё не та: замок и условие
    await page.getByTestId('cosmetic-crystal_prince').click();
    await expect(sheet).toContainText('Награда за лигу');
    await expect(sheet.getByTestId('skin-how-to')).toContainText('Platinum');
    await expect(sheet.getByTestId('cosmetic-league-req')).toContainText('Ваша лига: Silver');
    await expect(page.getByTestId('cosmetic-locked')).toBeDisabled();
    await expect(page.getByTestId('cosmetic-locked')).toContainText('Platinum');
    await page.keyboard.press('Escape');

    // предпросмотр не надевает и ничего не меняет на главной
    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'neon_punk');
  });

  test('league character: closed until the league; the new league gives it for free and offers to wear it', async ({
    page,
  }) => {
    const uid = 700001602;
    const user = await player(page, uid, 52_000, 5_000_000); // лига Silver, денег много
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('cosmetic-mecha').click();
    await expect(page.getByTestId('cosmetic-locked')).toBeDisabled();
    await expect(page.getByTestId('cosmetic-locked')).toContainText('Gold');
    await expect(page.getByTestId('cosmetic-buy')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // игрок дошёл до Gold: сцена новой лиги показывает персонажа-награду
    await setPlayer(uid, { totalEarned: 1_200_000, leagueLevel: 2 });
    await markLeagueSeen(page, uid, 1);
    await page.reload();
    await expect(page.getByTestId('league-up')).toBeVisible();
    await expect(page.getByTestId('league-up-name')).toHaveAttribute('aria-label', 'Gold');
    await expect(page.getByTestId('league-up-reward-name')).toHaveText('Меха');
    await page.getByTestId('league-up-equip').click();
    await expect(page.getByTestId('league-up')).toHaveCount(0);
    await expectCharacter(page, 'mecha');

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.equippedSkinId).toBe('mecha');
    // награда — бесплатно и без записи в базе: владение по лиге (баланс за это время мог только вырасти)
    expect(after.balance.toNumber()).toBeGreaterThanOrEqual(user.balance.toNumber());
    expect(await db.transaction.count({ where: { userId: user.id, type: 'cosmetic_purchase' } })).toBe(0);
    expect(await db.userCosmetic.count({ where: { userId: user.id } })).toBe(0);
    await page.getByTestId('nav-collection').click();
    await expect(page.getByTestId('cosmetic-mecha')).toHaveAttribute('data-state', 'equipped');
    await expect(page.getByTestId('cosmetic-crystal_prince')).toHaveAttribute('data-state', 'locked');
  });

  test('not enough coins for a tap effect: the buy button is disabled', async ({ page }) => {
    await player(page, 700001603, 52_000, 100); // уровень 3 ≥ 2 для «Сердечек», монет мало
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('shop-tabs-cosmetics').click();
    await page.getByTestId('cosmetic-hearts').click();
    await expect(page.getByTestId('cosmetic-buy')).toBeDisabled();
    await expect(page.getByTestId('cosmetic-modal')).toContainText('Не хватает монет');
  });

  test('premium character for Stars: delivered after payment and equipped', async ({ page }) => {
    const uid = 700001604;
    const user = await player(page, uid, 0, 0);
    await page.getByTestId('nav-shop').click();
    await expect(page.getByTestId('cosmetic-angel_guardian')).toHaveAttribute('data-state', 'available');
    await page.getByTestId('cosmetic-angel_guardian').click();
    await expect(page.getByTestId('cosmetic-buy')).toContainText('149');
    // вне Telegram счёт — dev-invoice://, оплату имитирует сервер
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    const purchase = await db.purchase.findFirstOrThrow({ where: { userId: user.id } });
    expect([purchase.productId, purchase.status]).toEqual(['skin_angel_guardian', 'PAID']);
    await page.keyboard.press('Escape');
    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'angel_guardian');
  });

  test('tap effects tab: buy and equip an effect', async ({ page }) => {
    const uid = 700001605;
    const user = await player(page, uid, 52_000, 10_000); // уровень 3 ≥ 2 для «Сердечек»
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('shop-tabs-cosmetics').click();
    await expect(page.getByTestId('shop-effects')).toBeVisible();
    await page.getByTestId('cosmetic-hearts').click();
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.equippedEffectId).toBe('hearts');
    expect(after.equippedSkinId).toBe('neon_punk');
  });

  test('every character works as the tap target: taps pay, idle loops, the world animates', async ({
    page,
  }) => {
    const uid = 700001608;
    const user = await player(page, uid, 0, 0);
    // выдать всех персонажей и надевать по очереди (как после покупок)
    const ids = ['inferno', 'toxic', 'astro_cat', 'lunar_witch'];
    await db.userCosmetic.createMany({
      data: ids.map((cosmeticId) => ({ userId: user.id, cosmeticId, source: 'admin' })),
      skipDuplicates: true,
    });
    for (const id of ids) {
      await db.user.update({ where: { id: user.id }, data: { equippedSkinId: id } });
      await page.reload();
      await expectCharacter(page, id);
      // спокойная анимация — бесконечный CSS-цикл на своём слое
      const idle = await page.locator('.hero-idle').evaluate((el) => {
        const cs = getComputedStyle(el);
        return { name: cs.animationName, count: cs.animationIterationCount };
      });
      expect(idle.name).not.toBe('none');
      expect(idle.count).toBe('infinite');
      // атмосфера сцены: частицы есть
      expect(await page.locator('[data-testid="skin-scene"] .amb').count()).toBeGreaterThan(0);
      // тапы по персонажу (голова, корпус, ноги) — награда
      const before = await balanceOf(page);
      const hit = (await page.getByTestId('cat-hit').boundingBox())!;
      for (const y of [0.15, 0.5, 0.9])
        await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height * y, HUMAN_TAP);
      // +3 за тапы (и, может быть, награда за достижение)
      await expect.poll(() => balanceOf(page)).toBeGreaterThanOrEqual(before + 3);
    }
  });

  test('rapid taps and rapid switching: no accumulated animations, last choice wins after reload', async ({
    page,
  }) => {
    const uid = 700001609;
    const user = await player(page, uid, 52_000, 20_000);
    await db.userCosmetic.createMany({
      data: ['desert_nomad', 'mecha'].map((cosmeticId) => ({ userId: user.id, cosmeticId, source: 'admin' })),
      skipDuplicates: true,
    });
    await page.reload();
    const before = await balanceOf(page);
    const hit = (await page.getByTestId('cat-hit').boundingBox())!;
    for (let i = 0; i < 30; i++)
      await page.mouse.click(
        hit.x + hit.width * (0.35 + (i % 3) * 0.15),
        hit.y + hit.height * 0.5,
        HUMAN_TAP,
      );
    // каждый из 30 тапов засчитан
    await expect.poll(() => balanceOf(page)).toBeGreaterThanOrEqual(before + 30);
    // реакция успокаивается полностью
    await expect
      .poll(() => page.locator('.hero-react').evaluate((el) => (el as HTMLElement).style.transform), {
        timeout: 6000,
      })
      .toBe('');

    // быстро переключать персонажей с карточек
    await page.getByTestId('nav-collection').click();
    for (const id of ['desert_nomad', 'mecha', 'neon_punk', 'desert_nomad', 'mecha']) {
      const btn = page.getByTestId(`equip-${id}`);
      await btn.click();
      await expect(page.getByTestId(`cosmetic-${id}`)).toHaveAttribute('data-state', 'equipped');
    }
    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'mecha');
    // на сцене один персонаж и один мир — старые не копятся
    await expect(page.locator('.hero-fig')).toHaveCount(1);
    await expect(page.getByTestId('skin-scene')).toHaveCount(1);
    // короткие анимации интерфейса (тосты, переход вкладки) доигрывают — бесконечных скриптовых не остаётся
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter((a) => !(a instanceof CSSAnimation) && a.playState === 'running').length,
          ),
        { timeout: 8000 },
      )
      .toBeLessThanOrEqual(4);
    await page.reload();
    await expectCharacter(page, 'mecha');
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).equippedSkinId).toBe('mecha');
  });

  test('a skin from the old collection in the database shows the new starter, old images are never loaded', async ({
    page,
  }) => {
    const uid = 700001610;
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));
    await page.goto(`/?uid=${uid}&name=Старожил`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { equippedSkinId: 'queen' });
    await page.reload();
    await expectCharacter(page, 'neon_punk');
    await page.getByTestId('nav-collection').click();
    await expect(page.getByTestId('cosmetic-neon_punk')).toHaveAttribute('data-state', 'equipped');
    expect(requested.filter((u) => u.includes('/assets/generated/hero/'))).toEqual([]);
  });

  test('server errors: the purchase is not shown as done, loading error offers a retry', async ({ page }) => {
    const uid = 700001606;
    const user = await player(page, uid, 52_000, 20_000);
    await page.route('**/api/collection/*/buy', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"INTERNAL"}' }),
    );
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('shop-tabs-cosmetics').click();
    await page.getByTestId('cosmetic-hearts').click();
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('toast-error')).toBeVisible();
    await expect(page.getByTestId('cosmetic-buy')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cosmetic-hearts')).toHaveAttribute('data-state', 'available');
    expect(await db.userCosmetic.count({ where: { userId: user.id } })).toBe(0);
    await page.unroute('**/api/collection/*/buy');

    // коллекция не загрузилась → ошибка и «Повторить»
    await page.route('**/api/collection', (route) => route.abort());
    await page.reload();
    await page.getByTestId('nav-shop').click();
    await expect(page.getByTestId('collection-loading')).toBeVisible();
    await expect(page.getByTestId('collection-error')).toBeVisible({ timeout: 30_000 });
    await page.unroute('**/api/collection');
    await page.getByTestId('collection-retry').click();
    await expect(page.getByTestId('cosmetic-desert_nomad')).toHaveAttribute('data-state', 'owned');
  });
});
