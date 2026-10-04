import { COSMETICS } from '@meowgul/shared';
import { expect, test, type Game } from './fixtures';

/**
 * Телефоны: 360–430 px и низкий экран 360×640 при плотности ×3. Ни один экран не прокручивается вбок, нижнее
 * меню на месте; картинки персонажей — файл не меньше места на экране (браузер ничего не растягивает).
 */
const SIZES: Array<[number, number]> = [
  [360, 780],
  [375, 812],
  [390, 844],
  [412, 915],
  [430, 932],
  [360, 640],
];

/** Все картинки скинов на экране: во сколько раз браузер растягивает файл (≤ 1 — не растягивает). */
async function worstUpscale(game: Game): Promise<{ worst: number; count: number; broken: string[] }> {
  return game.page.evaluate(async () => {
    let worst = 0;
    let count = 0;
    const broken: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-skin-file]'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.bottom < 0 || r.top > innerHeight) continue;
      let url = '';
      if (el instanceof HTMLImageElement) {
        if (!el.complete) await el.decode().catch(() => undefined);
        url = el.currentSrc;
      } else url = /url\("?([^")]+)"?\)/.exec(getComputedStyle(el).backgroundImage)?.[1] ?? '';
      if (!url) continue;
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => broken.push(url));
      if (!img.naturalHeight) continue;
      count++;
      worst = Math.max(worst, (r.height * devicePixelRatio) / img.naturalHeight);
    }
    return { worst, count, broken };
  });
}

for (const [width, height] of SIZES) {
  test.describe(`Scenario: phone ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

    test(`all main screens fit, skins are never upscaled (${width}×${height})`, async ({ game, page }) => {
      test.setTimeout(120_000);
      const bad: string[] = [];
      page.on('response', (r) => {
        if (r.url().includes('/assets/') && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
      });
      await game.login(710000700 + width + (height === 640 ? 1 : 0), {
        state: { balance: 2_000_000, totalEarned: 3_000_000, leagueLevel: 3, profitPerHour: 10_000n },
      });
      await game.expectFitsScreen();
      const home = await worstUpscale(game);
      expect(home.count).toBeGreaterThanOrEqual(2); // персонаж и фон
      expect(home.worst).toBeLessThanOrEqual(1.01);

      for (const open of ['open-mine', 'open-earn', 'open-boosts']) {
        await page.getByTestId(open).click();
        await page.waitForTimeout(500);
        await game.expectFitsScreen().catch(async () => {
          // экраны поверх вкладки закрывают меню — проверяем только прокрутку вбок
          expect(
            await page.evaluate(() => document.scrollingElement!.scrollWidth - innerWidth),
          ).toBeLessThanOrEqual(1);
        });
        await game.back();
      }

      for (const tab of ['friends', 'shop', 'airdrop', 'collection', 'profile'] as const) {
        await game.tab(tab);
        await game.expectFitsScreen();
        if (tab === 'shop' || tab === 'collection') {
          await page.waitForTimeout(600);
          const cards = await worstUpscale(game);
          expect(cards.count).toBeGreaterThanOrEqual(4);
          expect(cards.worst).toBeLessThanOrEqual(1.01);
          expect(cards.broken).toEqual([]);
        }
      }

      // окно персонажа: крупный персонаж, файл под размер, кнопка видна
      await game.tab('collection');
      await page.getByTestId('cosmetic-galaxy_emperor').click();
      await expect(page.getByTestId('skin-preview')).toBeVisible();
      await page.waitForTimeout(700);
      const modal = await worstUpscale(game);
      expect(modal.worst).toBeLessThanOrEqual(1.01);
      await expect(page.getByTestId('cosmetic-equip')).toBeInViewport();
      await game.back();
      expect(bad).toEqual([]);
    });
  });
}

test.describe('Scenario: every character looks sharp on the office', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test('all skins: the character and its world are loaded in a size that needs no upscaling', async ({
    game,
    page,
  }) => {
    test.setTimeout(240_000);
    const skins = COSMETICS.filter((c) => c.kind === 'skin').map((c) => c.id);
    for (const [i, id] of skins.entries()) {
      // свой игрок на каждый скин: сервер ограничивает частоту запросов одного игрока
      await game.login(710000801 + i, { state: { equippedSkinId: id } });
      await expect(page.getByTestId('hero')).toHaveAttribute('data-skin', id);
      await page.waitForTimeout(250);
      const { worst, count, broken } = await worstUpscale(game);
      expect(count, id).toBeGreaterThanOrEqual(2);
      expect(worst, id).toBeLessThanOrEqual(1.01);
      expect(broken, id).toEqual([]);
    }
  });
});
