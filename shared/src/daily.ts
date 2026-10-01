/** Комбо дня и шифр дня. */
import type { PlayerState } from './api.js';
import type { CardCategory, Localized } from './cards.js';

export interface ComboCard {
  id: string;
  name: Localized;
  icon: string;
  category: CardCategory;
}

export interface ComboState {
  dayKey: string;
  /** 3 слота: найденные карточки в порядке нахождения, null — ещё не угадано */
  slots: Array<ComboCard | null>;
  rewarded: boolean;
  reward: number;
}

export interface CipherState {
  dayKey: string;
  /** сколько букв в слове */
  length: number;
  hint: Localized;
  solved: boolean;
  reward: number;
}

export interface DailyGamesResponse {
  combo: ComboState;
  cipher: CipherState;
  nextResetAt: number;
}

export interface CipherClaimResponse {
  state: PlayerState;
  cipher: CipherState;
  reward: number;
}

/** Результат улучшения карточки для комбо: null — карточка не из сегодняшнего комбо или уже найдена. */
export interface ComboUpdate {
  combo: ComboState;
  /** награда за собранное комбо (0 — ещё не все три) */
  reward: number;
}
