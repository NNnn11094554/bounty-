import type { CardUpgradeResponse, CardView, PlayerState } from '@meowgul/shared';
import { useCards } from '../store/cards';
import { useDailyGames } from '../store/dailyGames';
import { runAction } from './actions';
import { payInvoice, type PayResult } from './payments';
import { endpoints } from '../api/endpoints';

/** Почему актив нельзя улучшить за монеты прямо сейчас (null — можно). Баланс — «живой» с клиента. */
export type CardBlock =
  | { kind: 'max' }
  | { kind: 'unavailable' }
  | { kind: 'locked' }
  | { kind: 'stars'; stars: number }
  | { kind: 'cooldown'; until: number }
  | { kind: 'funds'; missing: number };

export function cardBlock(card: CardView, balance: number, serverNow: number): CardBlock | null {
  if (card.nextPrice === null) return { kind: 'max' };
  if (!card.available) return { kind: 'unavailable' };
  if (card.lock) return { kind: 'locked' };
  // первый уровень платного актива — за Stars, а не за монеты
  if (card.starsPrice !== null) return { kind: 'stars', stars: card.starsPrice };
  if (card.cooldownUntil && card.cooldownUntil > serverNow)
    return { kind: 'cooldown', until: card.cooldownUntil };
  if (balance < card.nextPrice) return { kind: 'funds', missing: card.nextPrice - balance };
  return null;
}

function predict(card: CardView, s: PlayerState): PlayerState {
  return {
    ...s,
    balance: s.balance - (card.nextPrice ?? 0),
    profitPerHour: s.profitPerHour + (card.nextProfit ?? 0),
  };
}

/**
 * Купить следующий уровень карточки: баланс и прибыль в час меняются сразу,
 * карточки (и открывшиеся ими) обновляются по ответу сервера.
 */
export async function upgradeCard(card: CardView): Promise<CardUpgradeResponse | null> {
  const res = await runAction({
    request: () => endpoints.upgradeCard(card.id),
    predict: (s) => predict(card, s),
  });
  const store = useCards.getState();
  if (!res) {
    // сервер отказал (кулдаун, окно лимитки закрылось и т.п.) — показываем актуальные карточки
    void store.load(true);
    return null;
  }
  store.merge(res.cards);
  store.markUpgraded(card.id);
  if (res.combo) {
    const games = useDailyGames.getState();
    games.setCombo(res.combo.combo, card.id);
    if (res.combo.reward > 0) games.celebrateCombo(res.combo.reward);
  }
  return res;
}

/** Окупаемость следующего уровня в часах: цена / прирост дохода в час (null — максимум или за Stars). */
export function cardPaybackHours(card: CardView): number | null {
  if (card.nextPrice === null || card.nextProfit === null || card.starsPrice !== null) return null;
  return card.nextPrice / Math.max(1, card.nextProfit);
}

/** Открыть платный актив за Telegram Stars; после оплаты список активов обновляется с сервера. */
export async function unlockAsset(card: CardView): Promise<PayResult> {
  const result = await payInvoice(() => endpoints.assetInvoice(card.id));
  const store = useCards.getState();
  if (result === 'paid') {
    await store.load(true);
    store.markUpgraded(card.id);
  } else if (result === 'failed') {
    // условие или окно продажи могли измениться — показываем актуальное
    void store.load(true);
  }
  return result;
}
