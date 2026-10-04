import type { GameConfig, PlayerState } from '@meowgul/shared';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { useGame } from './store/game';

const state = {
  profile: {
    id: 1,
    telegramId: '1',
    firstName: 'Мурка',
    lastName: null,
    username: null,
    photoUrl: null,
    languageCode: 'ru',
    isPremium: false,
    isAdmin: false,
    isDeveloper: false,
    onboardingDone: false,
    settings: {
      language: null,
      sound: true,
      vibration: true,
      animations: 'full',
      notifications: true,
      devMode: false,
    },
    tutorialsSeen: [],
    createdAt: new Date().toISOString(),
  },
  balance: 44739415,
  totalEarned: 0,
  profitPerHour: 0,
  tapValue: 1,
  energy: 5000,
  maxEnergy: 5000,
  energyRegenPerSec: 3,
  multitapLevel: 1,
  energyLimitLevel: 1,
  leagueLevel: 0,
  tapSeq: 0,
  turboUntil: null,
  incomeBoostUntil: null,
  cosmetics: { skin: 'cyber_samurai', effect: 'coins' },
  totalTaps: 0,
  boosts: {
    fullEnergy: { left: 6, perDay: 6, cooldownUntil: null, cooldownSec: 3600 },
    turbo: { left: 3, perDay: 3, activeUntil: null, durationSec: 60, multiplier: 5 },
    multitap: { level: 1, nextLevel: 2, price: 2000, maxLevel: 20 },
    energyLimit: { level: 1, nextLevel: 2, price: 2000, maxLevel: 20, perLevel: 500 },
  },
  daily: { day: 1, claimedToday: false, streakBroken: false, streak: 0 },
  wallet: null,
  achievements: { unlocked: 0, total: 60, fresh: [] },
  events: { happyHour: null },
  serverTime: Date.now(),
  nextResetAt: Date.now() + 1000,
} satisfies PlayerState;

const config = {
  leagues: [
    { level: 0, id: 'bronze', name: 'Bronze', threshold: 0, color: '#cd7f32' },
    { level: 1, id: 'silver', name: 'Silver', threshold: 5000, color: '#c0c7d1' },
  ],
  tap: { syncIntervalMs: 2500, maxPerSecond: 20 },
  passive: { maxOfflineHours: 3 },
  turbo: { durationSec: 60, multiplier: 5 },
  dailyResetUtcHour: 16,
  dailyRewards: [500, 1000, 2500, 5000, 15000, 25000, 100000, 500000, 1000000, 5000000],
  referral: { regular: 5000, premium: 25000 },
} satisfies GameConfig;

function mockFetch(handler: (url: string) => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(handler(url))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  useGame.setState({ status: 'booting', player: null });
});

describe('App boot', () => {
  it('logs in with dev init data and shows the player', async () => {
    mockFetch((url) =>
      url.includes('/api/dev/init-data')
        ? Response.json({ initData: 'x' })
        : Response.json({ state, config, offline: null, isNew: true }),
    );
    render(<App />);
    expect(screen.getByTestId('splash')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('office')).toBeTruthy());
    expect(screen.getByTestId('player-name').textContent).toBe('Мурка');
    await waitFor(() =>
      expect(screen.getByTestId('balance-value').getAttribute('aria-label')?.replace(/\s/g, ' ')).toBe(
        '44 739 415',
      ),
    );
  });

  it('shows the ban screen', async () => {
    mockFetch((url) =>
      url.includes('/api/dev/init-data')
        ? Response.json({ initData: 'x' })
        : Response.json(
            { error: { code: 'BANNED', message: 'banned', details: { reason: 'cheating' } } },
            { status: 403 },
          ),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('screen-banned')).toBeTruthy());
  });

  it('shows the maintenance screen with server message', async () => {
    mockFetch((url) =>
      url.includes('/api/dev/init-data')
        ? Response.json({ initData: 'x' })
        : Response.json({ error: { code: 'MAINTENANCE', message: 'Чиним кота' } }, { status: 503 }),
    );
    render(<App />);
    await waitFor(() => expect(screen.getByText('Чиним кота')).toBeTruthy());
  });
});
