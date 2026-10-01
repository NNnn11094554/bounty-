import { describe, expect, it } from 'vitest';
import { formatDuration, formatInt, formatShort, formatSigned } from '../src/format.js';

const NB = ' ';

describe('formatInt', () => {
  it('groups thousands with spaces', () => {
    expect(formatInt(44739415)).toBe(`44${NB}739${NB}415`);
    expect(formatInt(999)).toBe('999');
    expect(formatInt(1000)).toBe(`1${NB}000`);
    expect(formatInt(0)).toBe('0');
    expect(formatInt(-1234)).toBe(`-1${NB}234`);
    expect(formatInt(12.9)).toBe('12');
    expect(formatInt(123456789012345678901234567890n)).toContain(`${NB}890`);
    expect(formatInt(Number.NaN)).toBe('0');
  });
});

describe('formatShort', () => {
  it('matches the design examples', () => {
    expect(formatShort(767200)).toBe('767,2K');
    expect(formatShort(10450)).toBe('10,45K');
    expect(formatShort(1024000)).toBe('1,02M');
    expect(formatShort(512000)).toBe('512K');
    expect(formatShort(100_000_000)).toBe('100M');
    expect(formatShort(1_000_000_000)).toBe('1B');
    expect(formatShort(5_000_000)).toBe('5M');
  });
  it('rounds down and keeps small numbers intact', () => {
    expect(formatShort(999)).toBe('999');
    expect(formatShort(1999)).toBe('1,99K');
    expect(formatShort(1_029_999)).toBe('1,02M');
    expect(formatShort(17.9)).toBe('17');
  });
  it('uses dot for English', () => {
    expect(formatShort(767200, 'en')).toBe('767.2K');
  });
  it('handles signs and garbage', () => {
    expect(formatSigned(838)).toBe('+838');
    expect(formatSigned(3930)).toBe('+3,93K');
    expect(formatSigned(0)).toBe('0');
    expect(formatShort(-2500)).toBe('-2,5K');
    expect(formatShort(Number.POSITIVE_INFINITY)).toBe('0');
  });
});

describe('formatDuration', () => {
  it('formats hh:mm:ss', () => {
    expect(formatDuration(1759)).toBe('00:29:19');
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(-5)).toBe('00:00:00');
    expect(formatDuration(93600)).toBe('26:00:00');
  });
});
