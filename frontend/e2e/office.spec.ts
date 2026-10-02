import { expect, test, type Page } from '@playwright/test';
import { setPlayer } from './db';

// темп быстрого живого игрока (~15 тапов/с): сервер срезает всё, что быстрее 20 тапов/с с прошлой
// синхронизации, а клики Playwright без пауз идут под 60/с — часть тапов честно отбрасывается антифродом
const HUMAN_TAP = { delay: 50 };

test.describe('Office', () => {
  test('tapping earns coins, spends energy and survives a reload', async ({ page }) => {
    await page.goto('/?uid=700000201&name=Тапер');
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('energy-value')).toHaveText('1000 / 1000');

    const box = (await page.getByTestId('cat-hit').boundingBox())!;
    for (let i = 0; i < 15; i++) {
      await page.mouse.click(box.x + box.width / 2 + (i % 5) * 6, box.y + box.height / 2 - (i % 3) * 6);
    }
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '15');
    await expect(page.getByTestId('energy-value')).toHaveText(/^98[5-9] \/ 1000$/);

    // ждём синхронизацию пачки и перезагружаем — монеты сохранены на сервере
    await page.waitForResponse((r) => r.url().includes('/api/tap') && r.ok(), { timeout: 8000 });
    await page.reload();
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '15');
  });

  test('the cat is only a tap target: no image menu, no navigation, no popups', async ({ page, context }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __opened: string[] };
      w.__opened = [];
      window.open = ((url?: string | URL) => {
        w.__opened.push(String(url));
        return null;
      }) as typeof window.open;
    });
    await page.goto('/?uid=700000203&name=Безссылок');
    const cat = page.getByTestId('hero');
    await expect(cat).toBeVisible();
    // в зоне тапа нет <img> и ссылок — WebView не покажет меню картинки «Открыть/Сохранить»
    await expect(cat.locator('img, a')).toHaveCount(0);
    const pages = context.pages().length;
    const url = page.url();

    const box = (await page.getByTestId('cat-hit').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    for (let i = 0; i < 8; i++) await page.touchscreen.tap(cx + (i % 3) * 8, cy - (i % 2) * 8);
    // долгое нажатие и контекстное меню — тоже ничего не открывают
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
    const prevented = await page.getByTestId('cat-hit').evaluate((el) => {
      const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(true);

    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '9');
    expect(page.url()).toBe(url);
    expect(context.pages().length).toBe(pages);
    expect(await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)).toEqual([]);

    // TEST 2: внешние ссылки работают через свои кнопки — «Пригласить» открывает окно «Поделиться»
    await page.getByTestId('nav-friends').click();
    await page.getByTestId('friends-invite').click();
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toContain('https://t.me/share/url?url=');
  });

  test('rapid taps: every tap counts, no long freezes, effect elements are reused', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __long: number[] };
      w.__long = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long.push(e.duration);
      }).observe({ type: 'longtask', buffered: false });
    });
    await page.goto('/?uid=700000204&name=Скорострел');
    const cat = page.getByTestId('hero');
    await expect(cat).toBeVisible();
    await page.waitForTimeout(1500); // стартовая загрузка экранов не в счёт
    await page.evaluate(() => ((window as unknown as { __long: number[] }).__long = []));
    const nodesBefore = await cat.evaluate((el) => el.querySelectorAll('*').length);

    const box = (await page.getByTestId('cat-hit').boundingBox())!;
    for (let i = 0; i < 100; i++) {
      await page.mouse.click(
        box.x + box.width / 2 + (i % 7) * 5,
        box.y + box.height / 2 - (i % 5) * 5,
        HUMAN_TAP,
      );
    }
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '100');
    await expect(page.getByTestId('energy-value')).toHaveText(/^9[0-9]{2} \/ 1000$/);
    // всплывающие «+1», кольца и частицы берутся из пула — DOM не растёт от тапов
    const nodesAfter = await cat.evaluate((el) => el.querySelectorAll('*').length);
    expect(nodesAfter).toBeLessThanOrEqual(nodesBefore + 4);
    // ни одной заметной заминки основного потока во время серии
    const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
    expect(Math.max(0, ...long)).toBeLessThan(250);
  });

  test('the cat itself is the tap target: no TAP button, no TAP or BOUNTY text', async ({ page }) => {
    // ошибки игры: исключения в скриптах, ошибки в консоли и сбои загрузки своих файлов
    // (внешний telegram-web-app.js из песочницы тестов недоступен — его не считаем)
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text());
    });
    page.on('requestfailed', (r) => {
      if (new URL(r.url()).hostname === 'localhost')
        errors.push(`${r.url()} ${r.failure()?.errorText ?? ''}`);
    });
    page.on('response', (r) => {
      if (new URL(r.url()).hostname === 'localhost' && r.status() >= 400)
        errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto('/?uid=700000206&name=Котоман');
    await expect(page.getByTestId('hero')).toBeVisible();
    await expect(page.getByTestId('tap-button')).toHaveCount(0);
    const text = await page.getByTestId('office').innerText();
    expect(text).not.toMatch(/\bTAP\b/);
    expect(text).not.toMatch(/bounty/i);
    // зона тапа — сам кот, почти во весь рост
    const hit = (await page.getByTestId('cat-hit').boundingBox())!;
    const body = (await page.getByTestId('hero-body').boundingBox())!;
    expect(hit.height).toBeGreaterThan(body.height * 0.95);
    expect(hit.width).toBeGreaterThan(body.width * 0.8);
    // тап по голове и по кроссовкам — тоже награда
    await page.mouse.click(hit.x + hit.width * 0.6, hit.y + hit.height * 0.12);
    await page.mouse.click(hit.x + hit.width * 0.45, hit.y + hit.height * 0.93);
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '2');
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('50 rapid taps: the cat returns exactly to its pose and does not drift', async ({ page }) => {
    await page.goto('/?uid=700000207&name=Барабанщик');
    await expect(page.getByTestId('hero')).toBeVisible();
    await page.waitForTimeout(800);
    const figure = page.locator('.hero-fig');
    const before = (await figure.boundingBox())!;
    const hit = (await page.getByTestId('cat-hit').boundingBox())!;
    for (let i = 0; i < 50; i++) {
      await page.mouse.click(
        hit.x + hit.width * (0.3 + (i % 5) * 0.1),
        hit.y + hit.height * (0.2 + (i % 4) * 0.18),
        HUMAN_TAP,
      );
    }
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '50');
    // пружины успокаиваются — трансформации реакции снимаются полностью
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>('.hero-react, .hero-part')]
              .map((el) => el.style.transform)
              .join(''),
          ),
        { timeout: 6000 },
      )
      .toBe('');
    // корпус, хвост, кроссовка, голова и ухо
    await expect(page.locator('.hero-react, .hero-part')).toHaveCount(5);
    const after = (await figure.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeLessThan(0.5);
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.5);
    // запущенные из скрипта анимации не копятся (остаются только бесконечные CSS-покачивания)
    const scripted = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => !(a instanceof CSSAnimation) && a.playState === 'running')
          .length,
    );
    expect(scripted).toBeLessThanOrEqual(4);
  });

  test('without energy taps give nothing and the cat looks tired; energy comes back', async ({ page }) => {
    const uid = 700000208;
    await page.addInitScript(() => {
      const w = window as unknown as { __sleepy: boolean };
      w.__sleepy = false;
      new MutationObserver(() => {
        if (document.querySelector('[data-testid="hero"][data-sleepy="true"]')) w.__sleepy = true;
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-sleepy'] });
    });
    await page.goto(`/?uid=${uid}&name=Усталый`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { energy: 0, energyUpdatedAt: new Date() });
    await page.reload();
    await expect(page.getByTestId('hero')).toBeVisible();
    await tapMany(page, 40);
    const gained = Number(await page.getByTestId('balance-value').getAttribute('aria-label'));
    // наградой стали только тапы на восстановившуюся энергию (3 в секунду)
    expect(gained).toBeGreaterThan(0);
    expect(gained).toBeLessThan(20);
    expect(await page.evaluate(() => (window as unknown as { __sleepy: boolean }).__sleepy)).toBe(true);
    const low = parseInt((await page.getByTestId('energy-value').innerText()).split('/')[0]!, 10);
    await page.waitForTimeout(2000);
    const later = parseInt((await page.getByTestId('energy-value').innerText()).split('/')[0]!, 10);
    expect(later).toBeGreaterThan(low);
  });

  test('shows stats, league and the per-hour hint', async ({ page }) => {
    await page.goto('/?uid=700000202&name=Мурка');
    await expect(page.getByTestId('stat-per-tap')).toHaveText('+1');
    await expect(page.getByTestId('stat-to-level')).toHaveText('5K');
    await expect(page.getByTestId('league-name')).toContainText('Bronze');
    await expect(page.getByTestId('league-level')).toHaveText('Level 1/10');
    await page.getByRole('button', { name: 'info' }).click();
    await expect(page.getByTestId('per-hour-hint')).toContainText('3');
  });
});

async function tapMany(page: Page, n: number) {
  const hit = (await page.getByTestId('cat-hit').boundingBox())!;
  for (let i = 0; i < n; i++) await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height * 0.5);
}
