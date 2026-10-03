import { expect, test, type Page } from '@playwright/test';
import { db, gameDay, markLeagueSeen, setPlayer } from './db';

async function press(page: Page, ms: number, at: { x: number; y: number }): Promise<void> {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Ввести слово азбукой Морзе: точка — 60 мс, тире — 450 мс, пауза между буквами — 1,1 с. */
async function typeMorse(page: Page, codes: string[]): Promise<void> {
  const box = (await page.getByTestId('cat-hit').boundingBox())!;
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  for (const code of codes) {
    for (const symbol of code) {
      await press(page, symbol === '.' ? 60 : 450, at);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1100);
  }
}

test.describe('Daily combo and cipher', () => {
  test('cipher: enter MEOW in Morse code and get 1 000 000', async ({ page }) => {
    const day = gameDay();
    await db.dailyCipher.upsert({
      where: { dayKey: day },
      create: { dayKey: day, word: 'MEOW', hintRu: 'Главное слово кота', hintEn: 'A cat word' },
      update: { word: 'MEOW', hintRu: 'Главное слово кота', hintEn: 'A cat word' },
    });
    const uid = 700000801;
    await page.goto(`/?uid=${uid}&name=Шифровальщик`);
    await expect(page.getByTestId('cipher-banner')).toContainText('+1 000 000');
    await markLeagueSeen(page, uid, 9);
    await page.getByTestId('cipher-enter').click();
    await expect(page.getByTestId('cipher-hint')).toHaveText('Главное слово кота');
    await expect(page.getByTestId('cipher-letters').locator('span.grid')).toHaveCount(4);

    // неверное слово: TUNA
    await typeMorse(page, ['-', '..-', '-.', '.-']);
    await expect(page.getByText('Неверное слово — попробуйте ещё раз')).toBeVisible();
    await expect(page.getByTestId('cipher-letters')).not.toContainText('T');

    // несуществующая буква
    await typeMorse(page, ['..--']);
    await expect(page.getByTestId('morse-flash')).toHaveText('Такой буквы нет');

    await typeMorse(page, ['--', '.', '---', '.--']);
    await expect(page.getByText('Шифр разгадан: +1 000 000!')).toBeVisible();
    await expect(page.getByTestId('cipher-solved')).toBeVisible();
    // 1 000 000 + достижения: шифр 50 000, заработок 10 000 + 50 000, лига Silver 2 000 (Gold — от 10 млн)
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^1\s112\s0\d\d$/);
  });

  test('cipher mode: taps do not earn coins, exit returns to tapping', async ({ page }) => {
    await page.goto('/?uid=700000802&name=Тихоня');
    await page.getByTestId('cipher-enter').click();
    const box = (await page.getByTestId('cat-hit').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '0');
    await page.getByTestId('cipher-help').click();
    await expect(page.getByTestId('morse-help')).toContainText('−•−•');
    await page.keyboard.press('Escape');
    await page.getByTestId('cipher-exit').click();
    await expect(page.getByTestId('cipher-enter')).toBeVisible();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', '1');
  });

  test('a press is not lost when the cat changes size mid-press', async ({ page }) => {
    const day = gameDay();
    await db.dailyCipher.upsert({
      where: { dayKey: day },
      create: { dayKey: day, word: 'MEOW', hintRu: 'Главное слово кота', hintEn: 'A cat word' },
      update: { word: 'MEOW', hintRu: 'Главное слово кота', hintEn: 'A cat word' },
    });
    await page.goto('/?uid=700000803&name=Растяжка');
    await page.getByTestId('cipher-enter').click();
    await expect(page.getByTestId('cipher-letters').locator('span.grid')).toHaveCount(4);
    await page.waitForTimeout(500);
    const box = (await page.getByTestId('cat-hit').boundingBox())!;
    // тире, во время которого окно меняет высоту (Telegram разворачивает Mini App) и кот — размер
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.width, height: size.height - 120 });
    await page.waitForTimeout(450);
    await page.mouse.up();
    await expect(page.getByTestId('cipher-letters')).toContainText('T');
  });

  test('combo: upgrading the three cards reveals slots and pays 5 000 000', async ({ page }) => {
    const day = gameDay();
    const cardIds = ['mk_p2p', 'pr_blog', 'lg_aml'];
    await db.dailyCombo.upsert({
      where: { dayKey: day },
      create: { dayKey: day, cardIds },
      update: { cardIds },
    });
    const uid = 700000803;
    await page.goto(`/?uid=${uid}&name=Комбинатор`);
    await expect(page.getByTestId('office')).toBeVisible();
    await setPlayer(uid, { balance: 100_000, totalEarned: 100_000, leagueLevel: 3 });
    await markLeagueSeen(page, uid, 9);
    await page.reload();
    await page.getByTestId('open-mine').click();
    await expect(page.getByTestId('combo')).toContainText('+5 000 000');
    await expect(page.getByTestId('combo-slot-0')).toHaveText('?');

    const buy = async (category: string, id: string) => {
      await page.getByTestId(`mine-cat-${category}`).click();
      await page.getByTestId(`card-${id}`).click();
      await page.getByTestId('card-buy').click();
      await expect(page.getByTestId('card-sheet').getByRole('dialog')).toBeHidden();
    };
    await buy('MARKETS', 'mk_p2p');
    await expect(page.getByTestId('combo-slot-0').locator('[data-card="mk_p2p"]')).toBeVisible();
    await expect(page.getByText('Карточка из комбо дня!')).toBeVisible();
    await buy('PR_TEAM', 'pr_blog');
    await buy('LEGAL', 'lg_aml');
    await expect(page.getByTestId('combo-celebration')).toContainText('+5 000 000');
    await expect(page.getByTestId('combo-done')).toBeVisible();
  });
});
