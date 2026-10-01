import { CARD_GLYPHS, CARD_ICON_BADGES, CARD_TEXT_BADGES, type CardView } from '@meowgul/shared';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardArt, CardIcon } from '../../components/cards/CardIcon';
import { cardBlock } from '../../game/cards';
import { limitedText, lockText } from './cardText';

const base: CardView = {
  id: 'mk_spot',
  category: 'MARKETS',
  name: { ru: 'Спот-торговля', en: 'Spot Trading' },
  description: { ru: '', en: '' },
  icon: 'candles/none/0',
  level: 3,
  maxLevel: 25,
  profitPerHour: 600,
  nextProfit: 260,
  nextPrice: 2310,
  cooldownUntil: null,
  cooldownSec: 0,
  lock: null,
  available: true,
  limited: null,
  sortOrder: 0,
};

describe('card icons', () => {
  it('draws every glyph and badge', () => {
    for (const glyph of CARD_GLYPHS) {
      const { container, unmount } = render(<CardIcon icon={`${glyph}/none/3`} size={64} />);
      const svg = container.querySelector('svg')!;
      // фон, блик, рамка и сам рисунок
      expect(svg.querySelectorAll('*').length).toBeGreaterThan(6);
      unmount();
    }
    for (const badge of [...CARD_ICON_BADGES, ...CARD_TEXT_BADGES]) {
      const { container, unmount } = render(<CardIcon icon={`coins/${badge}/1`} size={64} />);
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('shows the 24/7 label and keeps the character image untouched', () => {
    const { container } = render(<CardIcon icon="headset/247/1" size={64} />);
    expect(container.textContent).toContain('24/7');
    const art = render(<CardArt icon="character/star/0" seed="sp_ceo_photo" />);
    const image = art.container.querySelector('image')!;
    expect(image.getAttribute('href')).toBe('/assets/generated/character-256.webp');
    expect(image.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
  });
});

describe('card texts', () => {
  it('describes locks', () => {
    expect(
      lockText('ru', {
        type: 'card',
        cardId: 'x',
        level: 5,
        currentLevel: 1,
        name: { ru: 'Маржа x10', en: 'Margin x10' },
      }),
    ).toBe('Нужна карточка «Маржа x10» ур. 5');
    expect(lockText('ru', { type: 'friends', count: 1, current: 0 })).toBe('Пригласи 1 друга');
    expect(lockText('ru', { type: 'friends', count: 5, current: 0 })).toBe('Пригласи 5 друзей');
    expect(lockText('en', { type: 'friends', count: 1, current: 0 })).toBe('Invite 1 friend');
    expect(lockText('ru', { type: 'task', taskId: 't', title: null })).toBe('Выполни задание в Earn');
    expect(lockText('en', { type: 'task', taskId: 't', title: { ru: 'Канал', en: 'Channel' } })).toBe(
      'Complete the task “Channel”',
    );
    expect(lockText('ru', { type: 'league', level: 3, name: 'Platinum' })).toBe('Нужна лига Platinum');
  });

  it('formats limited timers', () => {
    const now = 1_000_000_000;
    const active = { ...base, limited: { until: now + 3_723_000, nextFrom: null } };
    expect(limitedText('ru', active, now)).toBe('Осталось 01:02:03');
    const later = { ...base, available: false, limited: { until: now + 9e6, nextFrom: now + 60_000 } };
    expect(limitedText('en', later, now)).toBe('Back in 00:01:00');
    const over = { ...base, available: false, limited: { until: now - 1, nextFrom: null } };
    expect(limitedText('ru', over, now)).toBe('Время вышло');
    expect(limitedText('ru', base, now)).toBeNull();
  });
});

describe('cardBlock', () => {
  const now = 5_000;
  it('allows buying when everything is fine', () => {
    expect(cardBlock(base, 5000, now)).toBeNull();
  });
  it('reports the first reason the card cannot be bought', () => {
    expect(cardBlock({ ...base, nextPrice: null, nextProfit: null }, 1e9, now)).toEqual({ kind: 'max' });
    expect(cardBlock({ ...base, available: false }, 1e9, now)).toEqual({ kind: 'unavailable' });
    expect(cardBlock({ ...base, lock: { type: 'friends', count: 3, current: 1 } }, 1e9, now)).toEqual({
      kind: 'locked',
    });
    expect(cardBlock({ ...base, cooldownUntil: now + 1000 }, 1e9, now)).toEqual({
      kind: 'cooldown',
      until: now + 1000,
    });
    expect(cardBlock({ ...base, cooldownUntil: now - 1 }, 5000, now)).toBeNull();
    expect(cardBlock(base, 2000, now)).toEqual({ kind: 'funds', missing: 310 });
  });
});
