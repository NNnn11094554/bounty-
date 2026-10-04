import type { PlayerState, TapResponse } from '@meowgul/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { TapEngine } from './tapEngine';

function state(over: Partial<PlayerState> = {}): PlayerState {
  return {
    profile: { id: 7 } as PlayerState['profile'],
    balance: 1000,
    totalEarned: 1000,
    profitPerHour: 0,
    tapValue: 1,
    energy: 500,
    maxEnergy: 500,
    energyRegenPerSec: 3,
    multitapLevel: 1,
    energyLimitLevel: 1,
    leagueLevel: 0,
    tapSeq: 0,
    turboUntil: null,
    incomeBoostUntil: null,
    events: { happyHour: null },
    serverTime: Date.now(),
    ...over,
  } as PlayerState;
}

/** Сервер в миниатюре: засчитывает пачку с номером один раз, как настоящий. */
function fakeServer() {
  const server = { tapSeq: 0, taps: 0, calls: [] as Array<{ seq: number; taps: number }> };
  let hold: (() => void) | null = null;
  const send = (seq: number, taps: number): Promise<TapResponse> => {
    server.calls.push({ seq, taps });
    if (seq > server.tapSeq) {
      server.tapSeq = seq;
      server.taps += taps;
    }
    const res: TapResponse = {
      state: state({ tapSeq: server.tapSeq, balance: 1000 + server.taps }),
      accepted: taps,
      duplicate: false,
      goldenCoin: null,
    };
    return new Promise((resolve) => {
      hold = () => resolve(res);
    });
  };
  const answer = async () => {
    hold?.();
    hold = null;
    await Promise.resolve();
    await Promise.resolve();
  };
  return { server, send, answer };
}

afterEach(() => localStorage.clear());

describe('tap engine: unsent taps survive closing the game', () => {
  it('closing while a batch is in flight keeps both the batch and newer taps; next launch sends them once', async () => {
    const { server, send, answer } = fakeServer();
    const a = new TapEngine(send);
    a.applyServerState(state());
    for (let i = 0; i < 5; i++) a.tap();
    void a.flush(); // пачка №1 (5 тапов) в пути
    for (let i = 0; i < 3; i++) a.tap(); // ещё 3 тапа ждут
    a.hide(); // игру закрывают, ответа на №1 ещё нет
    expect(JSON.parse(localStorage.getItem('meowgul.unsent.7')!)).toMatchObject({
      inflight: { seq: 1, taps: 5 },
      pending: 3,
    });

    // запрос №1 всё же дошёл до сервера, но игра уже закрыта; следующий вход
    await answer();
    const b = new TapEngine(send);
    b.applyServerState(state({ tapSeq: server.tapSeq, balance: 1000 + server.taps }));
    expect(localStorage.getItem('meowgul.unsent.7')).toBeNull();
    expect(b.unsentTaps).toBe(3); // №1 уже засчитан — повторно не уйдёт
    void b.flush();
    await answer();
    expect(server.taps).toBe(8);
  });

  it('a batch the server never got is resent with the same number (no double count if it lands late)', async () => {
    const { server, send, answer } = fakeServer();
    const a = new TapEngine(send);
    a.applyServerState(state());
    for (let i = 0; i < 4; i++) a.tap();
    a.hide(); // сразу отправка №1 и копия на устройстве
    expect(server.calls).toEqual([{ seq: 1, taps: 4 }]);
    // ответ не пришёл; сервер не успел записать (считаем, что запрос потерян)
    server.tapSeq = 0;
    server.taps = 0;
    const b = new TapEngine(send);
    b.applyServerState(state({ tapSeq: 0 }));
    expect(b.unsentTaps).toBe(4);
    void b.flush();
    expect(server.calls.at(-1)).toEqual({ seq: 1, taps: 4 });
    await answer();
    expect(server.taps).toBe(4);
  });

  it('back on screen: the device copy is dropped (taps go as usual, nothing is replayed twice)', async () => {
    const { server, send, answer } = fakeServer();
    const a = new TapEngine(send);
    a.applyServerState(state());
    for (let i = 0; i < 2; i++) a.tap();
    a.hide();
    await answer(); // №1 засчитан, копия на устройстве обновилась
    expect(localStorage.getItem('meowgul.unsent.7')).toBeNull();
    a.show();
    a.tap();
    // перезапуск без сворачивания: на устройстве ничего — третий тап не появится дважды
    const b = new TapEngine(send);
    b.applyServerState(state({ tapSeq: server.tapSeq }));
    expect(b.unsentTaps).toBe(0);
  });

  it('copies of other accounts on the same device are not mixed', () => {
    localStorage.setItem(
      'meowgul.unsent.99',
      JSON.stringify({ inflight: null, pending: 10, pendingEarned: 10 }),
    );
    const e = new TapEngine(fakeServer().send);
    e.applyServerState(state());
    expect(e.unsentTaps).toBe(0);
    expect(localStorage.getItem('meowgul.unsent.99')).not.toBeNull();
  });
});
