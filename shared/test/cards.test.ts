import { describe, expect, it } from 'vitest';
import { CARD_BADGE_LABELS, CARD_GLYPHS, isTextBadge, parseCardIcon } from '../src/cards.js';

describe('parseCardIcon', () => {
  it('parses glyph, badge and palette', () => {
    expect(parseCardIcon('rocket/MEME/8')).toEqual({
      glyph: 'rocket',
      badge: 'MEME',
      palette: 8,
      ticker: null,
    });
    expect(parseCardIcon('headset/247/1')).toEqual({
      glyph: 'headset',
      badge: '247',
      palette: 1,
      ticker: null,
    });
    expect(CARD_BADGE_LABELS['247']).toBe('24/7');
  });

  it('falls back on unknown parts instead of breaking the UI', () => {
    expect(parseCardIcon('unknown/whatever/99')).toEqual({
      glyph: 'coins',
      badge: 'none',
      palette: 99 % 12,
      ticker: null,
    });
    expect(parseCardIcon('fish')).toEqual({ glyph: 'fish', badge: 'none', palette: 0, ticker: null });
  });

  it('parses our own token coins: ticker on the coin, a broken ticker never breaks the UI', () => {
    expect(parseCardIcon('token/SOL/2')).toEqual({
      glyph: 'token',
      badge: 'none',
      palette: 2,
      ticker: 'SOL',
    });
    expect(parseCardIcon('token/bad ticker/3').ticker).toBe('?');
    expect(parseCardIcon('token/TOOLONGX/3').ticker).toBe('?');
  });

  it('distinguishes text badges', () => {
    expect(isTextBadge('NFT')).toBe(true);
    expect(isTextBadge('star')).toBe(false);
  });

  it('has unique glyph names', () => {
    expect(new Set(CARD_GLYPHS).size).toBe(CARD_GLYPHS.length);
  });
});
