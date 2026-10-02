import type { CardLock, CardView, Locale } from '@meowgul/shared';
import { formatDuration } from '@meowgul/shared';
import { plural, translate } from '../../i18n';

export function lockText(locale: Locale, lock: CardLock, short = false): string {
  switch (lock.type) {
    case 'card':
      return translate(locale, short ? 'card.lock.cardShort' : 'card.lock.card', {
        name: lock.name[locale],
        level: lock.level,
      });
    case 'friends':
      return translate(locale, 'card.lock.friends', {
        n: lock.count,
        friends: plural(locale, lock.count, {
          one: translate(locale, 'card.friends.one'),
          few: translate(locale, 'card.friends.few'),
          many: translate(locale, 'card.friends.many'),
        }),
      });
    case 'task':
      return lock.title
        ? translate(locale, 'card.lock.task', { title: lock.title[locale] })
        : translate(locale, 'card.lock.taskGeneric');
    case 'league':
      return translate(locale, 'card.lock.league', { name: lock.name });
  }
}

/** Подпись таймера лимитированной карточки (null — не лимитированная или без срока). */
export function limitedText(locale: Locale, card: CardView, serverNow: number): string | null {
  const l = card.limited;
  if (!l) return null;
  if (card.available && l.until)
    return translate(locale, 'card.limited.endsIn', { time: formatDuration((l.until - serverNow) / 1000) });
  if (l.nextFrom && l.nextFrom > serverNow) {
    return translate(locale, 'card.limited.returns', {
      time: formatDuration((l.nextFrom - serverNow) / 1000),
    });
  }
  return translate(locale, 'card.limited.over');
}
