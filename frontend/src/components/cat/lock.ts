import type { CosmeticDef } from '@meowgul/shared';
import { useGame } from '../../store/game';

/** Почему предмет ещё закрыт: не та лига (скин-награда) или мал уровень (эффект тапа). */
export type CosmeticLock = { by: 'league'; league: number } | { by: 'level'; level: number } | null;

export function lockOf(item: CosmeticDef, owned: boolean, level: number, league: number): CosmeticLock {
  if (owned) return null;
  if (item.unlockLeague !== undefined && league < item.unlockLeague) {
    return { by: 'league', league: item.unlockLeague };
  }
  if (level < item.unlockLevel) return { by: 'level', level: item.unlockLevel };
  return null;
}

/** Название лиги по номеру (из настроек игры, как на экране лиг). */
export function useLeagueName(): (league: number) => string {
  const leagues = useGame((s) => s.config?.leagues);
  return (league) => leagues?.[league]?.name ?? String(league + 1);
}
