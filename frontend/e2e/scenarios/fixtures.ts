import { expect, test as base, type CDPSession, type Page } from '@playwright/test';
import { db, markLeagueSeen, setPlayer } from '../db';

/**
 * Сценарии игры (e2e/scenarios): игрок с нужным состоянием, настоящие касания (CDP touch — как палец на
 * телефоне, в том числе несколькими пальцами), баланс с экрана и с сервера, вкладки и «Назад» (Escape —
 * как кнопка BackButton в Telegram).
 */

export type Tab = 'office' | 'friends' | 'shop' | 'airdrop' | 'collection' | 'profile';
type UserData = Parameters<typeof setPlayer>[1];

export interface LoginOptions {
  name?: string;
  /** состояние игрока в базе до показа (баланс, лига, энергия…) */
  state?: UserData;
  /** обучение для новичка */
  onboarding?: boolean;
  /** пригласивший: ?ref=ref_<id> */
  ref?: number;
  lang?: 'ru' | 'en';
}

export class Game {
  private cdp: CDPSession | null = null;
  uid = 0;

  constructor(readonly page: Page) {}

  /** Войти игроком uid; если задано состояние — записать его в базу и перезагрузить игру. */
  async login(uid: number, opts: LoginOptions = {}): Promise<void> {
    this.uid = uid;
    const q = new URLSearchParams({ uid: String(uid), name: opts.name ?? 'Игрок' });
    if (opts.onboarding) q.set('onboarding', '1');
    if (opts.ref) q.set('ref', `ref_${opts.ref}`);
    if (opts.lang) q.set('lang', opts.lang);
    await this.page.goto(`/?${q}`);
    if (opts.onboarding) {
      await expect(this.page.getByTestId('onboarding')).toBeVisible();
      return;
    }
    await expect(this.page.getByTestId('office')).toBeVisible();
    if (!opts.state) await this.dismissPopups();
    if (opts.state) {
      await setPlayer(uid, opts.state);
      // сцена «Новая лига» не перекрывает сценарий, если лигу поднимает сам тест
      const league = typeof opts.state.leagueLevel === 'number' ? opts.state.leagueLevel : 0;
      await markLeagueSeen(this.page, uid, league);
      await this.reload();
    }
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await expect(this.page.getByTestId('office')).toBeVisible();
    await this.dismissPopups();
  }

  /**
   * Окна, которые игра показывает сама при входе и которые закрыли бы сценарий: «Пока вас не было…» (по ТЗ —
   * после минуты отсутствия) и сцена новой лиги (бонусы за друга или старт поднимают лигу).
   */
  async dismissPopups(): Promise<void> {
    await this.page.waitForTimeout(300);
    const thanks = this.page.getByTestId('offline-thanks');
    if (await thanks.isVisible().catch(() => false)) await thanks.click();
    const leagueUp = this.page.getByTestId('league-up-close');
    if (await leagueUp.isVisible().catch(() => false)) await leagueUp.click();
  }

  /** Игрок в базе. */
  user() {
    return db.user.findUniqueOrThrow({ where: { telegramId: BigInt(this.uid) } });
  }

  /** Баланс на экране (число из aria-label счётчика). */
  async balance(testId = 'balance-value'): Promise<number> {
    const label = await this.page.getByTestId(testId).first().getAttribute('aria-label');
    return Number((label ?? '0').replace(/\D/g, ''));
  }

  /** Энергия на главной: [текущая, максимум]. */
  async energy(): Promise<[number, number]> {
    const text = (await this.page.getByTestId('energy-value').textContent()) ?? '0 / 0';
    const [a, b] = text.split('/').map((s) => Number(s.replace(/\D/g, '')));
    return [a ?? 0, b ?? 0];
  }

  private async touch(): Promise<CDPSession> {
    this.cdp ??= await this.page.context().newCDPSession(this.page);
    return this.cdp;
  }

  /** Центр зоны тапа (сам персонаж). */
  async catCenter(): Promise<{ x: number; y: number }> {
    const box = (await this.page.getByTestId('cat-hit').boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height * 0.5 };
  }

  /**
   * Тапы по персонажу настоящими касаниями: times раз, fingers пальцами одновременно, с паузой gapMs.
   * Возвращает, сколько касаний сделано.
   */
  async tap(times: number, { fingers = 1, gapMs = 60 } = {}): Promise<number> {
    const cdp = await this.touch();
    const c = await this.catCenter();
    const spots = [
      { x: -30, y: 0 },
      { x: 30, y: 25 },
      { x: 0, y: -50 },
      { x: 10, y: 60 },
      { x: -20, y: 40 },
    ];
    for (let i = 0; i < times; i++) {
      const touchPoints = Array.from({ length: fingers }, (_, f) => ({
        x: c.x + spots[f % spots.length]!.x + (i % 3) * 4,
        y: c.y + spots[f % spots.length]!.y + (i % 2) * 4,
        id: f + 1,
        radiusX: 8,
        radiusY: 8,
        force: 1,
      }));
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (gapMs) await this.page.waitForTimeout(gapMs);
    }
    return times * fingers;
  }

  /** Дождаться, пока сервер засчитает тапы: totalTaps в базе достигнет expected. */
  async serverTaps(expected: number, timeout = 20_000): Promise<void> {
    await expect
      .poll(async () => Number((await this.user()).totalTaps), { timeout, intervals: [500, 1000] })
      .toBe(expected);
  }

  async tab(tab: Tab): Promise<void> {
    await this.page.getByTestId(`nav-${tab}`).click();
    const screen = tab === 'collection' ? 'collection' : tab;
    await expect(this.page.getByTestId(screen)).toBeVisible();
  }

  /** «Назад» Telegram (BackButton): закрыть окно или экран поверх вкладки. */
  async back(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }

  /** Короткая проверка: страница не прокручивается вбок, нижнее меню на месте. */
  async expectFitsScreen(): Promise<void> {
    const res = await this.page.evaluate(() => ({
      scroll: document.scrollingElement!.scrollWidth - innerWidth,
      nav: (() => {
        const r = document.querySelector('[data-testid="nav-office"]')?.getBoundingClientRect();
        return r ? r.bottom <= innerHeight + 1 && r.top >= 0 : false;
      })(),
    }));
    expect(res.scroll).toBeLessThanOrEqual(1);
    expect(res.nav).toBe(true);
  }
}

export const test = base.extend<{ game: Game }>({
  game: async ({ page }, use) => {
    await use(new Game(page));
  },
});

export { db, expect, markLeagueSeen, setPlayer };
