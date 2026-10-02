import { expect, test } from '@playwright/test';

test.describe('Friends', () => {
  test('a friend joins by the link: both get bonuses, the friend is in the list', async ({ page }) => {
    const inviter = 700000901;
    await page.goto(`/?uid=${inviter}&name=Пригласивший`);
    await expect(page.getByTestId('office')).toBeVisible();
    await page.getByTestId('nav-friends').click();
    await expect(page.getByTestId('friends-empty')).toBeVisible();
    await expect(page.getByTestId('friends-count')).toHaveText('Список ваших друзей (0)');

    // друг открывает игру по ссылке ref_<id>
    await page.goto(`/?uid=700000902&name=Друг&ref=ref_${inviter}`);
    await expect(page.getByText('Вас пригласил(а) Пригласивший: +5 000 монет!')).toBeVisible();
    await expect(page.getByTestId('balance-value')).toHaveAttribute('aria-label', /^5\s000$/);

    // пригласивший вернулся: 5 000 + 20 000 за Silver друга подняли его в Gold
    await page.goto(`/?uid=${inviter}&name=Пригласивший`);
    await expect(page.getByTestId('league-up-name')).toHaveAttribute('aria-label', 'Gold');
    await page.getByTestId('league-up-close').click();
    await page.getByTestId('nav-friends').click();
    await expect(page.getByTestId('friends-count')).toHaveText('Список ваших друзей (1)');
    const row = page.getByTestId('friend-row');
    await expect(row).toContainText('Друг');
    await expect(row).toContainText('Silver');
    // 5 000 за приглашение + 20 000 за лигу Silver друга
    await expect(row.getByTestId('friend-bonus')).toHaveText('+25K');
    await expect(page.getByTestId('friends-earned')).toContainText('25 000');
  });

  test('copy and share the invite link; bonuses table', async ({ page, context }) => {
    const uid = 700000903;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // t.me недоступен из тестовой среды — отвечаем заглушкой, проверяем только адрес
    await context.route('https://t.me/**', (route) =>
      route.fulfill({ body: 'ok', contentType: 'text/plain' }),
    );
    await page.goto(`/?uid=${uid}&name=Связной`);
    await page.getByTestId('nav-friends').click();
    await page.getByTestId('friends-copy').click();
    await expect(page.getByText('Ссылка скопирована')).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(new RegExp(`^https://t\\.me/\\w+/\\w+\\?startapp=ref_${uid}$`));

    const popup = context.waitForEvent('page');
    await page.getByTestId('friends-invite').click();
    const share = await popup;
    expect(share.url()).toContain('https://t.me/share/url?url=');
    expect(decodeURIComponent(share.url())).toContain(`startapp=ref_${uid}`);
    await share.close();

    await page.getByTestId('friends-more').click();
    const sheet = page.getByTestId('friends-bonuses');
    await expect(sheet).toContainText('Silver');
    await expect(sheet).toContainText('+20K');
    await expect(sheet).toContainText('+40K');
  });

  test('pull to refresh reloads the list', async ({ page }) => {
    await page.goto('/?uid=700000904&name=Тянущий');
    await page.getByTestId('nav-friends').click();
    await expect(page.getByTestId('friends-empty')).toBeVisible();
    const box = (await page.getByTestId('friends-scroll').boundingBox())!;
    const reload = page.waitForResponse((r) => r.url().includes('/api/friends') && r.ok());
    await page.mouse.move(box.x + box.width / 2, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 260, { steps: 10 });
    await expect(page.getByTestId('pull-indicator')).toHaveCSS('opacity', '1');
    await page.mouse.up();
    await reload;
  });

  test('earn invite task leads to the friends tab', async ({ page }) => {
    await page.goto('/?uid=700000905&name=Задачник');
    await page.getByTestId('nav-earn').click();
    await page.getByTestId('task-invite_3').click();
    await page.getByTestId('task-invite').click();
    await expect(page.getByTestId('friends')).toBeVisible();
  });
});
