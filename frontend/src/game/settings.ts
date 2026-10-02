import type { PlayerSettings } from '@meowgul/shared';
import { endpoints } from '../api/endpoints';
import { applyClientSettings } from '../lib/clientSettings';
import { runAction } from './actions';
import { tapEngine } from './tapEngine';

/**
 * Изменить настройку: сразу применяем на клиенте (язык, звук, вибрация, анимации), сохраняем на сервере;
 * при ошибке возвращаем как было (тост покажет runAction).
 */
export async function changeSettings(patch: Partial<PlayerSettings>): Promise<boolean> {
  const before = tapEngine.snapshotNow();
  if (!before) return false;
  const prev = before.profile.settings;
  const next = { ...prev, ...patch };
  const lang = before.profile.languageCode;
  applyClientSettings(next, lang);
  const res = await runAction({
    request: () => endpoints.updateSettings(patch),
    predict: (s) => ({ ...s, profile: { ...s.profile, settings: next } }),
  });
  applyClientSettings(res ? res.state.profile.settings : prev, lang);
  return Boolean(res);
}
