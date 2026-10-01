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
    hqId: null,
    onboardingDone: false,
    settings: { language: null, sound: true, vibration: true, animations: 'full', notifications: true },
    tutorialsSeen: [],
    createdAt: new Date().toISOString(),
  },
  balance: 44739415,
  totalEarned: 0,
  profitPerHour: 0,
  tapValue: 1,
  energy: 1000,
  maxEnergy: 1000,
  energyRegenPerSec: 3,
  multitapLevel: 1,
  energyLimitLevel: 1,
  leagueLevel: 0,
  tapSeq: 0,
  serverTime: Date.now(),
  nextResetAt: Date.now() + 1000,
};

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
        : Response.json({ state, offline: null, isNew: true }),
    );
    render(<App />);
    expect(screen.getByTestId('splash')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('home')).toBeTruthy());
    expect(screen.getByText('Мурка')).toBeTruthy();
    expect(screen.getByTestId('home').textContent?.replace(/\s/g, ' ')).toContain('44 739 415');
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
