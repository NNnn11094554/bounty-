/** Международная азбука Морзе (латиница) — шифр дня вводится тапами: короткий — точка, долгий — тире. */
export const MORSE: Readonly<Record<string, string>> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
};

const DECODE = new Map(Object.entries(MORSE).map(([letter, code]) => [code, letter]));

/** Буква по последовательности точек и тире; null — такой буквы нет. */
export function decodeMorse(code: string): string | null {
  return DECODE.get(code) ?? null;
}

export function encodeMorse(word: string): string[] {
  return [...word.toUpperCase()].map((ch) => MORSE[ch] ?? '');
}

/** Нажатие дольше этого — тире, короче — точка. */
export const MORSE_DASH_MS = 300;
/** Пауза дольше этого — буква закончена. */
export const MORSE_LETTER_PAUSE_MS = 900;
