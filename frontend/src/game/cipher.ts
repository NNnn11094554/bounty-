import { decodeMorse, formatInt, MORSE_DASH_MS, MORSE_LETTER_PAUSE_MS } from '@meowgul/shared';
import { create } from '../store/create';
import { endpoints } from '../api/endpoints';
import { translate } from '../i18n';
import { playSound } from '../lib/sound';
import { useDailyGames } from '../store/dailyGames';
import { useGame } from '../store/game';
import { toast } from '../store/toasts';
import { haptic } from '../telegram/webapp';
import { runAction } from './actions';
import { centerOf, confetti, flyCoins } from './effects';

/** Самая длинная буква в азбуке Морзе — 4 знака; длиннее — ошибка ввода. */
const MAX_CODE = 4;

interface CipherInput {
  active: boolean;
  letters: string[];
  /** точки и тире текущей буквы */
  code: string;
  /** вспышка после буквы: верная (зелёная) или несуществующая (красная) */
  flash: { ok: boolean; letter: string | null; at: number } | null;
  submitting: boolean;
  /** растёт при неверном слове — плитки букв трясутся */
  shake: number;
}

export const useCipherInput = create<CipherInput>(() => ({
  active: false,
  letters: [],
  code: '',
  flash: null,
  submitting: false,
  shake: 0,
}));

let pauseTimer: ReturnType<typeof setTimeout> | null = null;

function clearPause(): void {
  if (pauseTimer) clearTimeout(pauseTimer);
  pauseTimer = null;
}

export function enterCipher(): void {
  clearPause();
  haptic.impact('medium');
  useCipherInput.setState({ active: true, letters: [], code: '', flash: null, submitting: false });
}

export function exitCipher(): void {
  clearPause();
  useCipherInput.setState({ active: false, letters: [], code: '', flash: null, submitting: false });
}

export function eraseLetter(): void {
  clearPause();
  const { letters, code } = useCipherInput.getState();
  if (code) useCipherInput.setState({ code: '' });
  else useCipherInput.setState({ letters: letters.slice(0, -1) });
  haptic.select();
}

async function submit(word: string): Promise<void> {
  useCipherInput.setState({ submitting: true });
  const locale = useGame.getState().locale;
  const res = await runAction({
    request: () => endpoints.claimCipher(word),
    errorKey: (err) => (err.code === 'NOT_COMPLETED' ? 'cipher.wrong' : undefined),
  });
  if (!res) {
    useCipherInput.setState((s) => ({ submitting: false, letters: [], code: '', shake: s.shake + 1 }));
    return;
  }
  useDailyGames.getState().setCipher(res.cipher);
  const origin = centerOf(document.querySelector('[data-testid="cipher-banner"]'));
  confetti(origin, 120);
  flyCoins(origin, 18);
  playSound('reward');
  haptic.notify('success');
  toast.success(translate(locale, 'cipher.success', { reward: formatInt(res.reward) }));
  exitCipher();
}

function commitLetter(): void {
  pauseTimer = null;
  const state = useCipherInput.getState();
  const length = useDailyGames.getState().cipher?.length ?? 0;
  if (!state.code || state.submitting) return;
  const letter = decodeMorse(state.code);
  if (!letter) {
    haptic.notify('error');
    useCipherInput.setState({ code: '', flash: { ok: false, letter: null, at: Date.now() } });
    return;
  }
  const letters = [...state.letters, letter].slice(0, length);
  haptic.notify('success');
  useCipherInput.setState({ code: '', letters, flash: { ok: true, letter, at: Date.now() } });
  if (letters.length === length) void submit(letters.join(''));
}

/** Нажатие на кота в режиме шифра: короткое — точка, долгое — тире; пауза завершает букву. */
export function cipherPress(durationMs: number): void {
  const state = useCipherInput.getState();
  if (!state.active || state.submitting) return;
  const symbol = durationMs >= MORSE_DASH_MS ? '-' : '.';
  const code = state.code + symbol;
  playSound('click');
  if (code.length > MAX_CODE) {
    clearPause();
    haptic.notify('error');
    useCipherInput.setState({ code: '', flash: { ok: false, letter: null, at: Date.now() } });
    return;
  }
  useCipherInput.setState({ code });
  clearPause();
  pauseTimer = setTimeout(commitLetter, MORSE_LETTER_PAUSE_MS);
}
