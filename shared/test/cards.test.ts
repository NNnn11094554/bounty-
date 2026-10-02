import { describe, expect, it } from 'vitest';
import { CARD_BADGE_LABELS, CARD_GLYPHS, isTextBadge, parseCardIcon } from '../src/cards.js';

describe('parseCardIcon', () => {
  it('parses glyph, badge and palette', () => {
    expect(parseCardIcon('rocket/MEME/8')).toEqual({ glyph: 'rocket', badge: 'MEME', palette: 8 });
    expect(parseCardIcon('headset/247/1')).toEqual({ glyph: 'headset', badge: '247', palette: 1 });
    expect(CARD_BADGE_LABELS['247']).toBe('24/7');
  });

  it('falls back on unknown parts instead of breaking the UI', () => {
    expect(parseCardIcon('unknown/whatever/99')).toEqual({ glyph: 'coins', badge: 'none', palette: 99 % 12 });
    expect(parseCardIcon('fish')).toEqual({ glyph: 'fish', badge: 'none', palette: 0 });
  });

  it('distinguishes text badges', () => {
    expect(isTextBadge('NFT')).toBe(true);
    expect(isTextBadge('star')).toBe(false);
  });

  it('has unique glyph names', () => {
    expect(new Set(CARD_GLYPHS).size).toBe(CARD_GLYPHS.length);
  });
});
