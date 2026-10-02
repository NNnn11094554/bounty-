import type { PlayerSettings } from '@meowgul/shared';
import { setReducedMotion } from '../animations';
import { resolveLocale } from '../i18n';
import { useGame } from '../store/game';
import { setHapticsEnabled } from '../telegram/webapp';
import { setSoundEnabled } from './sound';

/** Применить настройки игрока к клиенту: язык, звук, вибрация, анимации. */
export function applyClientSettings(settings: PlayerSettings, telegramLang: string): void {
  useGame.getState().setLocale(resolveLocale(settings.language, telegramLang));
  setHapticsEnabled(settings.vibration);
  setSoundEnabled(settings.sound);
  setReducedMotion(settings.animations === 'reduced');
}
