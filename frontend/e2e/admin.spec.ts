import { expect, test } from '@playwright/test';
import { db } from './db';

const ADMIN = 700000001;

test.describe('Admin panel', () => {
  test('players do not get in', async ({ page }) => {
    await page.goto('/admin?uid=700001401&name=Игрок');
    await expect(page.getByTestId('admin-denied')).toContainText('Нет доступа');
  });

  test('stats, player card with credit and ban, card editor, settings, broadcast draft', async ({ page }) => {
    // игрок, которым будем управлять
    await page.goto('/?uid=700001402&name=Подопечный');
    await expect(page.getByTestId('office')).toBeVisible();

    await page.goto(`/admin?uid=${ADMIN}&name=Админ`);
    await expect(page.getByTestId('admin-stats')).toBeVisible();
    await expect(page.getByTestId('admin-stats')).toContainText('Всего игроков');
    const shots = process.env.SCREENSHOTS;
    if (shots) await page.screenshot({ path: `${shots}/26-admin-stats.png`, fullPage: true });

    // игроки: поиск → карточка → начисление → бан
    await page.getByTestId('admin-tab-players').click();
    await page.getByTestId('admin-player-search').fill('700001402');
    await page.getByTestId('admin-player-row').first().click();
    await expect(page.getByTestId('admin-player')).toContainText('Подопечный');
    page.on('dialog', (d) => void d.accept());
    await page.getByTestId('admin-credit-amount').fill('2500');
    await page.getByTestId('admin-credit-reason').fill('Компенсация за сбой');
    await page.getByTestId('admin-credit-apply').click();
    await expect(page.getByTestId('admin-tx').first()).toContainText('admin_adjustment');
    await expect(page.getByTestId('admin-tx').first()).toContainText('Компенсация за сбой');
    await page.getByTestId('admin-ban-reason').fill('Проверка бана');
    await page.getByTestId('admin-ban').click();
    await expect(page.getByTestId('admin-player')).toContainText('Проверка бана');
    if (shots) await page.screenshot({ path: `${shots}/27-admin-player.png`, fullPage: true });
    const banned = await db.user.findUniqueOrThrow({ where: { telegramId: 700001402n } });
    expect(banned).toMatchObject({ isBanned: true, banReason: 'Проверка бана' });
    expect(banned.balance.toNumber()).toBe(2500);

    // карточки: правка названия с превью уровней
    await page.getByTestId('admin-tab-cards').click();
    await page.getByTestId('admin-card-mk_spot').click();
    await expect(page.getByTestId('admin-card-levels')).toBeVisible();
    await expect(page.getByTestId('admin-card-warnings')).toBeVisible();
    await page.getByTestId('admin-card-name-ru').fill('Спот-торговля PRO');
    if (shots) await page.screenshot({ path: `${shots}/28-admin-card.png`, fullPage: true });
    await page.getByTestId('admin-card-save').click();
    await expect(page.getByTestId('admin-cards')).toContainText('Спот-торговля PRO');
    const card = await db.card.findUniqueOrThrow({ where: { id: 'mk_spot' } });
    expect(card.nameRu).toBe('Спот-торговля PRO');

    // настройки: дополнительный счастливый час
    await page.getByTestId('admin-tab-settings').click();
    await page.getByTestId('admin-hh-start').fill('2030-01-01T12:00');
    await page.getByTestId('admin-hh-save').click();
    await expect(page.getByTestId('admin-next-hh')).toContainText('×2');

    // рассылка: черновик
    await page.getByTestId('admin-tab-broadcasts').click();
    await page.getByTestId('admin-bc-text').fill('Новое обновление: золотая монета!');
    await page.getByTestId('admin-bc-create').click();
    await expect(page.getByTestId('admin-bc-item').first()).toHaveAttribute('data-status', 'DRAFT');
    if (shots) await page.screenshot({ path: `${shots}/29-admin-broadcasts.png`, fullPage: true });

    // вернуть как было для других сценариев
    await db.user.update({ where: { telegramId: 700001402n }, data: { isBanned: false, banReason: null } });
    await db.card.update({ where: { id: 'mk_spot' }, data: { nameRu: card.nameRu.replace(' PRO', '') } });
    await db.appSetting.update({
      where: { key: 'happyHour' },
      data: { value: { auto: false, override: null } },
    });
  });
});
