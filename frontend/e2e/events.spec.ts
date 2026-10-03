import { expect, test } from '@playwright/test';
import { db, setPlayer } from './db';

test.describe('Mini-events and tutorials', () => {
  test.afterEach(async () => {
    // e2e-база по умолчанию без событий — возвращаем как было
    await db.appSetting.update({
      where: { key: 'happyHour' },
      data: { value: { auto: false, override: null } },
    });
    await db.appSetting.update({ where: { key: 'goldenCoin' }, data: { value: { enabled: false } } });
  });

  test('happy hour doubles taps and shows the timer', async ({ page }) => {
    const now = Date.now();
    await db.appSetting.update({
      where: { key: 'happyHour' },
      data: {
        value: {
          auto: false,
          override: {
            startsAt: new Date(now - 60_000).toISOString(),
            endsAt: new Date(now + 30 * 60_000).toISOString(),
            multiplier: 2,
          },
        },
      },
    });
    const uid = 700001301;
    // настройки сервер кеширует до 10 секунд
    await page.waitForTimeout(10_500);
    await page.goto(`/?uid=${uid}&name=Счастливчик`);
    await expect(page.getByTestId('happy-hour')).toContainText('Счастливый час ×2');
    await expect(page.getByTestId('happy-hour')).toContainText(/2\d:\d\d|30:00/);
    const cat = (await page.getByTestId('cat-hit').boundingBox())!;
    for (let i = 0; i < 5; i++) await page.mouse.click(cat.x + cat.width / 2, cat.y + cat.height / 2);
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '10');
    await page.waitForResponse((r) => r.url().includes('/api/tap') && r.ok(), { timeout: 8000 });
    const shots = process.env.SCREENSHOTS;
    if (shots) await page.screenshot({ path: `${shots}/23-happy-hour.png` });
    const user = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
    expect(user.balance.toNumber()).toBe(10);
  });

  test('golden coin runs across the office and can be caught', async ({ page }) => {
    const uid = 700001302;
    await page.goto(`/?uid=${uid}&name=Ловец`);
    await expect(page.getByTestId('office')).toBeVisible();
    // монета, выпущенная сервером: подставляем её в ответ на пачку тапов, чтобы не ждать случайности
    const user = await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } });
    let eventId = '';
    await page.route('**/api/tap', async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      if (!eventId) {
        const appearsAt = new Date(Date.now() + 1_000);
        const event = await db.userEvent.create({
          data: {
            userId: user.id,
            kind: 'golden_coin',
            reward: 1_000n,
            appearsAt,
            expiresAt: new Date(appearsAt.getTime() + 4_000),
          },
        });
        eventId = event.id;
        body.goldenCoin = {
          id: event.id,
          appearsAt: appearsAt.getTime(),
          expiresAt: event.expiresAt.getTime(),
          reward: 1_000,
        };
      }
      await route.fulfill({ response: res, json: body });
    });
    const cat = (await page.getByTestId('cat-hit').boundingBox())!;
    await page.mouse.click(cat.x + cat.width / 2, cat.y + cat.height / 2);
    const coin = page.getByTestId('golden-coin');
    await expect(coin).toBeVisible({ timeout: 8_000 });
    // монета выбегает из-за края экрана — ловим её в середине пути
    await page.waitForTimeout(2_600);
    const shots = process.env.SCREENSHOTS;
    if (shots) await page.screenshot({ path: `${shots}/24-golden-coin.png` });
    const box = (await coin.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByText('Золотая монета поймана: +1 000!')).toBeVisible();
    // 1 000 за монету + достижения «Ловкая лапа» 5 000 и «Серебряный кот» 2 000
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^8\s00\d$/);
    const claimed = await db.userEvent.findUniqueOrThrow({ where: { id: eventId } });
    expect(claimed.claimedAt).not.toBeNull();
  });

  test('tab tutorials show once and are remembered', async ({ page }) => {
    const uid = 700001303;
    await page.goto(`/?uid=${uid}&name=Новичок&tutorials=1`);
    const tutorial = page.getByTestId('tutorial');
    await expect(tutorial).toBeVisible();
    await expect(page.getByTestId('tutorial-text')).toContainText('Тапай кота');
    const shots = process.env.SCREENSHOTS;
    if (shots) {
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${shots}/25-tutorial.png` });
    }
    await page.getByTestId('tutorial-next').click();
    await expect(page.getByTestId('tutorial-text')).toContainText('энергию');
    await page.getByTestId('tutorial-next').click();
    await page.getByTestId('tutorial-next').click();
    await page.getByTestId('tutorial-next').click();
    await expect(page.getByTestId('tutorial-text')).toContainText('профиль');
    await page.getByTestId('tutorial-next').click();
    await expect(tutorial).toBeHidden();

    await page.getByTestId('open-mine').click();
    await expect(page.getByTestId('tutorial')).toHaveAttribute('data-tutorial', 'mine');
    await expect(page.getByTestId('tutorial-text')).toContainText('Крипто-активы');
    await page.getByTestId('tutorial-skip').click();
    await expect(tutorial).toBeHidden();

    await expect
      .poll(
        async () => (await db.user.findUniqueOrThrow({ where: { telegramId: BigInt(uid) } })).tutorialsSeen,
      )
      .toEqual(['office', 'mine']);
    await page.reload();
    await expect(page.getByTestId('office')).toBeVisible();
    await page.waitForTimeout(1_500);
    await expect(tutorial).toHaveCount(0);
    await setPlayer(uid, { tutorialsSeen: [] });
  });
});
