import { useEffect } from 'react';
import { endpoints } from '../api/endpoints';
import { exitCipher } from '../game/cipher';
import { tapEngine } from '../game/tapEngine';
import { useDailyGames } from '../store/dailyGames';
import { useGame } from '../store/game';
import { useTasks } from '../store/tasks';

const RETRY_MS = 30_000;
const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * Новый игровой день без перезапуска игры: в момент сброса подтягиваем состояние
 * (ежедневная награда, бусты), новое комбо и шифр, задания.
 */
export function useDayRollover(): void {
  const nextResetAt = useGame((s) => s.player?.nextResetAt ?? 0);
  useEffect(() => {
    if (!nextResetAt) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      exitCipher();
      void useDailyGames.getState().load(true);
      void useTasks.getState().load(true);
      endpoints
        .state()
        .then((res) => tapEngine.applyServerState(res.state))
        .catch(() => {
          timer = setTimeout(refresh, RETRY_MS);
        });
    };
    const delay = nextResetAt - tapEngine.serverNow() + 1_500;
    timer = setTimeout(refresh, Math.min(Math.max(delay, 1_000), MAX_TIMEOUT));
    return () => clearTimeout(timer);
  }, [nextResetAt]);
}
