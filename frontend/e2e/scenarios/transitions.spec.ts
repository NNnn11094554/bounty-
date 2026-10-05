import { gameDay } from '../db';
import { db, expect, test, type Tab } from './fixtures';

/**
 * Переходы между вкладками: вкладка не пересоздаётся, скрытая заморожена (components/TabLayer) — при любом
 * темпе нажатий на экране ровно одна вкладка, последняя выбранная; анимации не зависают и не наслаиваются;
 * вкладка помнит прокрутку, а данные обновляет при каждом показе; скрытые вкладки не работают в фоне.
 */
const TABS: Tab[] = ['friends', 'shop', 'airdrop', 'collection', 'profile', 'office'];

test.describe('Scenario: tab transitions', () => {
  test('rapid switching: always exactly one visible tab — the last one chosen, no stuck animations', async ({
    game,
    page,
  }) => {
    await game.login(710000901);
    // все вкладки построены (заранее, в свободное время, или при первом открытии)
    for (const tab of TABS) await game.tab(tab);

    // очень быстро: несколько кругов подряд без пауз, последним — «Профиль»
    await page.evaluate((tabs) => {
      for (let round = 0; round < 3; round++)
        for (const t of [...tabs, 'profile'])
          document.querySelector<HTMLElement>(`[data-testid="nav-${t}"]`)!.click();
    }, TABS);
    await expect(page.locator('[data-tab]')).toHaveAttribute('data-tab', 'profile');
    await expect(page.getByTestId('nav-profile')).toHaveAttribute('aria-current', 'page');
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => ({
      visible: Array.from(document.querySelectorAll<HTMLElement>('[data-tab-layer]'))
        .filter((l) => getComputedStyle(l).visibility === 'visible')
        .map((l) => l.dataset.tabLayer),
      frozen: Array.from(document.querySelectorAll<HTMLElement>('[data-tab-layer][data-frozen]')).map((l) => [
        l.dataset.tabLayer,
        getComputedStyle(l).contentVisibility,
      ]),
      // анимации переходов (проявление вкладки, подпрыгивание иконки меню) доиграли или прерваны — ни одна
      // не висит и не наслаивается
      running: document
        .getAnimations()
        .filter((a) => {
          const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
          const transition =
            el?.classList.contains('tab-layer') || Boolean(el?.closest('[data-testid="bottom-nav"]'));
          return transition && a.playState === 'running';
        })
        .map((a) => (a as CSSAnimation).animationName ?? 'waapi'),
      opacity: getComputedStyle(document.querySelector('[data-tab]')!).opacity,
    }));
    expect(state.visible).toEqual(['profile']);
    expect(state.frozen).toHaveLength(TABS.length - 1);
    for (const [, cv] of state.frozen) expect(cv).toBe('hidden');
    expect(state.running).toEqual([]);
    expect(state.opacity).toBe('1');
    await game.expectFitsScreen();

    // настоящими касаниями с короткими паузами: та же картина
    for (const tab of ['shop', 'office', 'collection', 'friends'] as const) {
      await page.getByTestId(`nav-${tab}`).click({ delay: 20 });
    }
    await expect(page.locator('[data-tab]')).toHaveAttribute('data-tab', 'friends');
    await expect(page.getByTestId('friends')).toBeVisible();
    await expect(page.locator('[data-tab]')).toHaveCount(1);
  });

  test('a tab keeps its scroll and state, and reloads its data on every visit', async ({ game, page }) => {
    await game.login(710000902);
    const profileLoads: string[] = [];
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/profile') profileLoads.push(r.url());
    });
    await game.tab('profile');
    await expect.poll(() => profileLoads.length).toBe(1);
    const scroller = page.getByTestId('profile');
    await scroller.evaluate((el) => el.scrollTo({ top: 420 }));
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(300);
    const before = await scroller.evaluate((el) => el.scrollTop);

    await game.tab('shop');
    await page.getByTestId('shop-tabs-special').click();
    await game.tab('profile');
    // та же прокрутка, свежие данные
    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(before);
    await expect.poll(() => profileLoads.length).toBe(2);
    // и в магазине — открытый раздел на месте
    await game.tab('shop');
    await expect(page.getByTestId('shop-tabs-special')).toHaveAttribute('aria-checked', 'true');
  });

  test('hidden tabs do no work: no frame loop on a static tab, the office resumes with the current balance', async ({
    game,
    page,
  }) => {
    // считаем запросы кадров (requestAnimationFrame) — скрытая главная не должна их держать
    await page.addInitScript(() => {
      const w = window as unknown as { __raf: number };
      w.__raf = 0;
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => {
        w.__raf++;
        return raf(cb);
      };
    });
    await game.login(710000903, {
      state: { balance: 100_000, totalEarned: 100_000, profitPerHour: 36_000n },
    });
    await game.tab('profile');
    // празднования (всплывашка достижения, конфетти) — разовые анимации поверх экранов: дождаться их конца
    const quiet = () =>
      page.evaluate(
        () =>
          !document.querySelector('[data-testid="achievement-popup"]') &&
          // холст конфетти (components/EffectsLayer) скрыт, пока частиц нет; звёздный фон — не в счёт
          Array.from(document.querySelectorAll('canvas.fixed')).every(
            (c) => getComputedStyle(c).visibility === 'hidden',
          ),
      );
    await expect.poll(quiet, { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(800);
    const framesOnProfile = await page.evaluate(async () => {
      const w = window as unknown as { __raf: number };
      const start = w.__raf;
      await new Promise((r) => setTimeout(r, 1000));
      return w.__raf - start;
    });
    // статичный экран: ни одного цикла (раньше скрытые числа главной гоняли бы 60 кадров/с)
    expect(framesOnProfile).toBeLessThanOrEqual(3);

    // главная в покое: числа обновляются ~10 раз в секунду, а не каждый кадр
    await game.tab('office');
    await page.waitForTimeout(1500);
    const framesOnOffice = await page.evaluate(async () => {
      const w = window as unknown as { __raf: number };
      const start = w.__raf;
      await new Promise((r) => setTimeout(r, 1000));
      return w.__raf - start;
    });
    expect(framesOnOffice).toBeLessThanOrEqual(25);

    // пока игрок на другой вкладке, доход капает (10 монет в секунду); вернулся — баланс уже верный
    const left = await game.balance();
    await game.tab('shop');
    await page.waitForTimeout(2000);
    await game.tab('office');
    await expect.poll(() => game.balance(), { timeout: 1000 }).toBeGreaterThanOrEqual(left + 15);
  });

  test('a screen over the tab (Assets): the tab under it sleeps and wakes up as the screen slides out', async ({
    game,
    page,
  }) => {
    await game.login(710000905, {
      state: { balance: 100_000, totalEarned: 100_000, profitPerHour: 36_000n },
    });
    const office = page.locator('[data-tab-layer="office"]');
    await expect(office).not.toHaveAttribute('data-frozen');
    const before = await game.balance();
    await page.getByTestId('open-mine').click();
    await expect(page.getByTestId('mine')).toBeVisible();
    // экран въехал и закрыл главную — она не анимируется и не перерисовывается
    await expect(office).toHaveAttribute('data-frozen', '');
    expect(await office.evaluate((el) => getComputedStyle(el).contentVisibility)).toBe('hidden');
    await page.waitForTimeout(1500);
    await game.back();
    await expect(page.getByTestId('mine')).toBeHidden();
    await expect(office).not.toHaveAttribute('data-frozen');
    await expect(page.getByTestId('office')).toBeVisible();
    // доход за время на экране «Активы» уже в счётчике (10 монет в секунду)
    await expect.poll(() => game.balance(), { timeout: 1000 }).toBeGreaterThanOrEqual(before + 15);
  });

  test('leaving the office exits the cipher input mode (as before, when the tab was rebuilt)', async ({
    game,
    page,
  }) => {
    const day = gameDay();
    await db.dailyCipher.upsert({
      where: { dayKey: day },
      create: { dayKey: day, word: 'MEOW', hintRu: 'Главное слово кота', hintEn: 'A cat word' },
      update: {},
    });
    await game.login(710000904);
    await page.getByTestId('cipher-enter').click();
    await expect(page.getByTestId('cipher-letters')).toBeVisible();
    await game.tab('shop');
    await game.tab('office');
    await expect(page.getByTestId('cipher-enter')).toBeVisible();
    await expect(page.getByTestId('cipher-letters')).toHaveCount(0);
  });
});
