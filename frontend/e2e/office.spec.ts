import { expect, test } from '@playwright/test';

test.describe('Office', () => {
  test('tapping earns coins, spends energy and survives a reload', async ({ page }) => {
    await page.goto('/?uid=700000201&name=Тапер');
    await expect(page.getByTestId('office')).toBeVisible();
    await expect(page.getByTestId('energy-value')).toHaveText('1000 / 1000');

    const cat = page.getByTestId('cat-button');
    const box = (await cat.boundingBox())!;
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
    const cat = page.getByTestId('cat-button');
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
    const cat = page.getByTestId('cat-button');
    await expect(cat).toBeVisible();
    await page.waitForTimeout(1500); // стартовая загрузка экранов не в счёт
    await page.evaluate(() => ((window as unknown as { __long: number[] }).__long = []));
    const nodesBefore = await cat.evaluate((el) => el.querySelectorAll('*').length);

    const box = (await page.getByTestId('cat-hit').boundingBox())!;
    for (let i = 0; i < 100; i++) {
      await page.mouse.click(box.x + box.width / 2 + (i % 7) * 5, box.y + box.height / 2 - (i % 5) * 5);
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
