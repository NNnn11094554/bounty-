import type { GoldenCoinEvent, PlayerState, TapResponse } from '@meowgul/shared';
import { api, ApiError } from '../api/client';

/**
 * Движок тапов. Тапы копятся локально и уходят пачкой раз в syncIntervalMs и при сворачивании.
 * Энергия и баланс на клиенте считаются так же, как на сервере (оптимистично), и после ответа
 * сервера выравниваются по его состоянию — сервер всегда прав.
 *
 * Протокол пачек: у каждой пачки номер seq. Пока пачка не подтверждена, она отправляется повторно
 * с тем же номером; сервер не засчитывает номер дважды. Новые тапы копятся отдельно.
 */
type Listener = (state: PlayerState) => void;

export class TapEngine {
  private snapshot: PlayerState | null = null;
  /** performance.now() момента, на который рассчитан snapshot */
  private snapshotAt = 0;
  private clockOffset = 0;
  private pending = 0;
  private pendingEarned = 0;
  private inflight: { seq: number; taps: number; earned: number } | null = null;
  private nextSeq = 1;
  /** локальная энергия и момент, на который она посчитана (как на сервере) */
  private energy = 0;
  private energyAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private backoffUntil = 0;
  private listeners = new Set<Listener>();
  private syncIntervalMs = 2500;
  private sending = false;

  /** результат синхронизации: для индикатора связи */
  onSync: ((ok: boolean, err?: unknown) => void) | null = null;
  /** сервер выпустил золотую монету */
  onGoldenCoin: ((coin: GoldenCoinEvent) => void) | null = null;

  constructor(private readonly send: (seq: number, taps: number) => Promise<TapResponse> = defaultSend) {}

  start(syncIntervalMs: number): void {
    this.syncIntervalMs = syncIntervalMs;
    this.stop();
    this.timer = setInterval(() => void this.flush(), this.syncIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  get state(): PlayerState | null {
    return this.snapshot;
  }

  /** Принять состояние с сервера (вход, тапы, покупки) и пересчитать локальные значения. */
  applyServerState(state: PlayerState, now = performance.now()): void {
    if (this.inflight && state.tapSeq >= this.inflight.seq) this.inflight = null;
    this.snapshot = state;
    this.snapshotAt = now;
    this.clockOffset = state.serverTime - Date.now();
    this.nextSeq = Math.max(this.nextSeq, state.tapSeq + 1, (this.inflight?.seq ?? 0) + 1);
    const unackedTaps = this.pending + (this.inflight?.taps ?? 0);
    this.energy = Math.max(0, state.energy - (this.turboActive() ? 0 : unackedTaps * state.tapValue));
    this.energyAt = now;
    this.listeners.forEach((l) => l(state));
  }

  serverNow(): number {
    return Date.now() + this.clockOffset;
  }

  turboActive(): boolean {
    const until = this.snapshot?.turboUntil;
    return Boolean(until && until > this.serverNow());
  }

  /** Энергия «сейчас» с восстановлением, без потери дробных долей. */
  energyNow(now = performance.now()): number {
    const s = this.snapshot;
    if (!s) return 0;
    const gained = Math.floor(((now - this.energyAt) * s.energyRegenPerSec) / 1000);
    return Math.min(s.maxEnergy, this.energy + Math.max(0, gained));
  }

  private normalizeEnergy(now: number): void {
    const s = this.snapshot;
    if (!s) return;
    const regen = s.energyRegenPerSec;
    const gained = Math.floor(((now - this.energyAt) * regen) / 1000);
    if (gained <= 0) return;
    if (this.energy + gained >= s.maxEnergy) {
      this.energy = s.maxEnergy;
      this.energyAt = now;
    } else {
      this.energy += gained;
      this.energyAt += (gained * 1000) / regen;
    }
  }

  /** Баланс «сейчас»: снимок сервера + пассивный доход + неподтверждённые тапы. */
  balanceNow(now = performance.now()): number {
    const s = this.snapshot;
    if (!s) return 0;
    const passive = (s.profitPerHour * Math.max(0, now - this.snapshotAt)) / 3_600_000;
    return s.balance + passive + this.pendingEarned + (this.inflight?.earned ?? 0);
  }

  totalEarnedNow(now = performance.now()): number {
    const s = this.snapshot;
    if (!s) return 0;
    return s.totalEarned + (this.balanceNow(now) - s.balance);
  }

  /** Множитель счастливого часа сейчас (1 — обычное время). */
  happyHourMultiplier(): number {
    const hh = this.snapshot?.events.happyHour;
    if (!hh) return 1;
    const now = this.serverNow();
    return hh.startsAt <= now && now < hh.endsAt ? hh.multiplier : 1;
  }

  /** Монет за один тап сейчас (с Turbo и счастливым часом). */
  tapReward(): number {
    const s = this.snapshot;
    if (!s) return 0;
    return s.tapValue * (this.turboActive() ? turboMultiplier : 1) * this.happyHourMultiplier();
  }

  /**
   * Текущее состояние «как будто с сервера» (без неподтверждённых тапов) — основа для
   * оптимистичных предсказаний: applyServerState(predict(snapshotNow())) не теряет ни тапов, ни дохода.
   */
  snapshotNow(now = performance.now()): PlayerState | null {
    const s = this.snapshot;
    if (!s) return null;
    const unacked = this.pending + (this.inflight?.taps ?? 0);
    const passive = (s.profitPerHour * Math.max(0, now - this.snapshotAt)) / 3_600_000;
    return {
      ...s,
      balance: s.balance + passive,
      totalEarned: s.totalEarned + passive,
      energy: Math.min(s.maxEnergy, this.energyNow(now) + (this.turboActive() ? 0 : unacked * s.tapValue)),
      serverTime: s.serverTime + (now - this.snapshotAt),
    };
  }

  /** Тап: true — засчитан локально; false — не хватает энергии. */
  tap(now = performance.now()): boolean {
    const s = this.snapshot;
    if (!s) return false;
    const turbo = this.turboActive();
    if (!turbo) {
      this.normalizeEnergy(now);
      if (this.energy < s.tapValue) return false;
      this.energy -= s.tapValue;
    }
    this.pending += 1;
    this.pendingEarned += this.tapReward();
    return true;
  }

  get unsentTaps(): number {
    return this.pending + (this.inflight?.taps ?? 0);
  }

  /** Отправить накопленное (или повторить неподтверждённую пачку). */
  async flush(): Promise<void> {
    if (this.sending || !this.snapshot) return;
    if (Date.now() < this.backoffUntil) return;
    if (!this.inflight) {
      if (this.pending === 0) return;
      this.inflight = { seq: this.nextSeq++, taps: this.pending, earned: this.pendingEarned };
      this.pending = 0;
      this.pendingEarned = 0;
    }
    const batch = this.inflight;
    this.sending = true;
    try {
      const res = await this.send(batch.seq, batch.taps);
      if (this.inflight?.seq === batch.seq) this.inflight = null;
      this.applyServerState(res.state);
      this.onSync?.(true);
      if (res.goldenCoin) this.onGoldenCoin?.(res.goldenCoin);
    } catch (err) {
      this.onSync?.(false, err);
      if (err instanceof ApiError) {
        if (err.code === 'RATE_LIMITED') this.backoffUntil = Date.now() + 10_000;
        else if (err.code === 'VALIDATION')
          this.inflight = null; // такую пачку сервер не примет никогда
        else if (!err.isNetwork) this.backoffUntil = Date.now() + 3_000;
      }
    } finally {
      this.sending = false;
    }
  }
}

let turboMultiplier = 5;
export function setTurboMultiplier(value: number): void {
  turboMultiplier = value;
}

function defaultSend(seq: number, taps: number): Promise<TapResponse> {
  return api<TapResponse>('/api/tap', {
    method: 'POST',
    body: { seq, taps, clientTime: Date.now() },
    retry: false,
    silent: false,
  });
}

/** Единственный экземпляр движка на приложение. */
export const tapEngine = new TapEngine();
