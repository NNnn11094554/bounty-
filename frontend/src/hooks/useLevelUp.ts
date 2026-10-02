import { COSMETICS, playerLevel } from '@meowgul/shared';
import { useEffect } from 'react';
import { catMood } from '../game/catMood';
import { tapEngine } from '../game/tapEngine';
import { translate } from '../i18n';
import { useGame } from '../store/game';
import { toast } from '../store/toasts';

/**
 * Новый уровень игрока (по заработанным монетам): кот празднует, игрок видит, какие скины и эффекты
 * открылись. Проверка раз в секунду — без подписки на каждый тап.
 */
export function useLevelUp(): void {
  const locale = useGame((s) => s.locale);
  useEffect(() => {
    let last = 0;
    const id = window.setInterval(() => {
      if (!tapEngine.state) return;
      const level = playerLevel(tapEngine.totalEarnedNow()).level;
      if (last && level > last) {
        catMood.emit('levelUp');
        toast.reward(translate(locale, 'level.up', { level }));
        const opened = COSMETICS.filter((c) => c.unlockLevel > last && c.unlockLevel <= level);
        if (opened.length) {
          toast.info(
            translate(locale, 'level.unlocked', { names: opened.map((c) => c.name[locale]).join(', ') }),
          );
        }
      }
      last = level;
    }, 1000);
    return () => window.clearInterval(id);
  }, [locale]);
}
