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

/** Персонажи коллекции: сейчас все три бесплатные, стартовый — первый. */
const SKINS = ['cyber_samurai', 'galaxy_emperor', 'shadow_drifter'];
/** Персонажи, убранные из коллекции (переделываются), и скины прошлой коллекции. */
const REMOVED = ['neon_punk', 'desert_nomad', 'astro_cat', 'mecha', 'angel_guardian', 'royal_emperor'];
const OLD = ['black_crown', 'pink_angel', 'cyber', 'queen', 'diamond', 'legendary_crown'];

test.describe('Skins and collection', () => {
  test('free character: equipped without buying → it becomes the cat and its world, kept after reload, starter can be equipped back', async ({
    page,
  }) => {
    const uid = 700001601;
    const user = await player(page, uid, 52_000, 20_000); // лига Silver
    await expectCharacter(page, 'cyber_samurai');

    await page.getByTestId('nav-shop').click();
    await expect(page.getByTestId('shop-skins')).toBeVisible();
    // все три персонажа — у всех бесплатно, ни замков, ни цен
    await expect(page.getByTestId('shop')).toContainText('Все персонажи сейчас бесплатные');
    await expect(page.getByTestId('cosmetic-cyber_samurai')).toHaveAttribute('data-state', 'equipped');
    await expect(page.getByTestId('cosmetic-galaxy_emperor')).toHaveAttribute('data-state', 'owned');
    await expect(page.getByTestId('cosmetic-shadow_drifter')).toHaveAttribute('data-state', 'owned');
    await expect(
      page.locator('[data-testid="shop-skins"] [data-testid^="cosmetic-"][data-state]'),
    ).toHaveCount(SKINS.length);
    for (const old of [...REMOVED, ...OLD]) await expect(page.getByTestId(`cosmetic-${old}`)).toHaveCount(0);

    await page.getByTestId('cosmetic-shadow_drifter').click();
    await expect(page.getByTestId('cosmetic-modal')).toBeVisible();
    await expect(page.getByTestId('cosmetic-name')).toHaveText('Теневой Бродяга');
    await expect(page.getByTestId('skin-how-to')).toContainText('Бесплатный');
    await expect(page.getByTestId('cosmetic-price')).toHaveCount(0);
    await expect(page.getByTestId('cosmetic-buy')).toHaveCount(0);
    await page.getByTestId('cosmetic-equip').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('cosmetic-shadow_drifter')).toHaveAttribute('data-state', 'equipped');

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.equippedSkinId).toBe('shadow_drifter');
    // бесплатно: ничего не списано, в базе ничего не выдаётся
    expect(after.balance.toNumber()).toBeGreaterThanOrEqual(user.balance.toNumber());
    expect(await db.transaction.count({ where: { userId: user.id, type: 'cosmetic_purchase' } })).toBe(0);
    expect(await db.userCosmetic.count({ where: { userId: user.id } })).toBe(0);

    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'shadow_drifter');
    // все картинки персонажа есть на сервере (каждый размер, AVIF и WebP)
    const sizes = {
      character: [600, 900, 1200, 1600],
      background: [1200, 1800, 2400, 3000],
      card: [480, 720, 960],
    };
    for (const [file, list] of Object.entries(sizes))
      for (const size of list)
        for (const ext of ['avif', 'webp']) {
          const res = await page.request.get(`/assets/skins/shadow_drifter/${file}-${size}.${ext}`);
          expect(res.ok(), `${file}-${size}.${ext}`).toBe(true);
        }
    await page.reload();
    await expectCharacter(page, 'shadow_drifter');

    // вкладка «Коллекция»: вернуть стартового кнопкой на карточке
    await page.getByTestId('nav-collection').click();
    await expect(page.getByTestId('collection')).toBeVisible();
    // 3 персонажа + эффект «монетки»
    await expect(page.getByTestId('collection-subtitle')).toContainText('открыто 4');
    await page.getByTestId('equip-cyber_samurai').click();
    await expect(page.getByTestId('cosmetic-cyber_samurai')).toHaveAttribute('data-state', 'equipped');
    await expect(page.getByTestId('cosmetic-shadow_drifter')).toHaveAttribute('data-state', 'owned');
    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'cyber_samurai');
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).equippedSkinId).toBe(
      'cyber_samurai',
    );
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
    await expect(sheet.getByTestId('skin-how-to')).toContainText('Бесплатный');
    await expect(page.getByTestId('cosmetic-equip')).toBeVisible();
    await expect(page.getByTestId('cosmetic-buy')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // премиальный эффект тапа — за звёзды
    await page.getByTestId('collection-tabs-effect').click();
    await page.getByTestId('cosmetic-matrix').click();
    await expect(sheet).toContainText('Премиум');
    await expect(page.getByTestId('cosmetic-buy')).toContainText('99');
    await page.keyboard.press('Escape');

    // предпросмотр не надевает и ничего не меняет на главной
    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'cyber_samurai');
  });

  test('new league: the scene has no character reward now, the worn character stays', async ({ page }) => {
    const uid = 700001602;
    const user = await player(page, uid, 52_000, 5_000_000); // лига Silver
    await setPlayer(uid, { totalEarned: 1_200_000, leagueLevel: 2, equippedSkinId: 'galaxy_emperor' });
    await markLeagueSeen(page, uid, 1);
    await page.reload();
    await expect(page.getByTestId('league-up')).toBeVisible();
    await expect(page.getByTestId('league-up-name')).toHaveAttribute('aria-label', 'Gold');
    await expect(page.getByTestId('league-up-reward')).toHaveCount(0);
    await expect(page.getByTestId('league-up-equip')).toHaveCount(0);
    await page.getByTestId('league-up-close').click();
    await expect(page.getByTestId('league-up')).toHaveCount(0);
    await expectCharacter(page, 'galaxy_emperor');
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.equippedSkinId).toBe('galaxy_emperor');
    expect(await db.userCosmetic.count({ where: { userId: user.id } })).toBe(0);
  });

  test('not enough coins for a tap effect: the buy button is disabled', async ({ page }) => {
    await player(page, 700001603, 52_000, 100); // уровень 3 ≥ 2 для «Сердечек», монет мало
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('shop-tabs-cosmetics').click();
    await page.getByTestId('cosmetic-hearts').click();
    await expect(page.getByTestId('cosmetic-buy')).toBeDisabled();
    await expect(page.getByTestId('cosmetic-modal')).toContainText('Не хватает монет');
  });

  test('premium tap effect for Stars: delivered after payment and equipped', async ({ page }) => {
    const uid = 700001604;
    const user = await player(page, uid, 0, 0);
    await page.getByTestId('nav-shop').click();
    await page.getByTestId('shop-tabs-cosmetics').click();
    await expect(page.getByTestId('cosmetic-matrix')).toHaveAttribute('data-state', 'available');
    await page.getByTestId('cosmetic-matrix').click();
    await expect(page.getByTestId('cosmetic-buy')).toContainText('99');
    // вне Telegram счёт — dev-invoice://, оплату имитирует сервер
    await page.getByTestId('cosmetic-buy').click();
    await expect(page.getByTestId('cosmetic-equipped')).toBeVisible();
    const purchase = await db.purchase.findFirstOrThrow({ where: { userId: user.id } });
    expect([purchase.productId, purchase.status]).toEqual(['effect_matrix', 'PAID']);
    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect([after.equippedSkinId, after.equippedEffectId]).toEqual(['cyber_samurai', 'matrix']);
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
    expect(after.equippedSkinId).toBe('cyber_samurai');
  });

  test('every character works as the tap target: taps pay, idle loops, the world animates', async ({
    page,
  }) => {
    const uid = 700001608;
    const user = await player(page, uid, 0, 0);
    for (const id of SKINS) {
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
    for (const id of [
      'galaxy_emperor',
      'shadow_drifter',
      'cyber_samurai',
      'galaxy_emperor',
      'shadow_drifter',
    ]) {
      const btn = page.getByTestId(`equip-${id}`);
      await btn.click();
      await expect(page.getByTestId(`cosmetic-${id}`)).toHaveAttribute('data-state', 'equipped');
    }
    await page.getByTestId('nav-office').click();
    await expectCharacter(page, 'shadow_drifter');
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
    await expectCharacter(page, 'shadow_drifter');
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).equippedSkinId).toBe(
      'shadow_drifter',
    );
  });

  test('a removed or old-collection skin in the database shows the starter, its images are never loaded', async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));
    for (const [uid, skin] of [
      [700001610, 'queen'],
      [700001611, 'royal_emperor'],
    ] as const) {
      await page.goto(`/?uid=${uid}&name=Старожил`);
      await expect(page.getByTestId('office')).toBeVisible();
      await setPlayer(uid, { equippedSkinId: skin });
      await page.reload();
      await expectCharacter(page, 'cyber_samurai');
      await page.getByTestId('nav-collection').click();
      await expect(page.getByTestId('cosmetic-cyber_samurai')).toHaveAttribute('data-state', 'equipped');
    }
    const removed = [...REMOVED, ...OLD].map((id) => `/assets/skins/${id}/`);
    expect(requested.filter((u) => removed.some((r) => u.includes(r)))).toEqual([]);
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
    await expect(page.getByTestId('cosmetic-galaxy_emperor')).toHaveAttribute('data-state', 'owned');
  });
});
