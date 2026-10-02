"""Бэктест стратегии на исторических свечах OKX.

Модель исполнения (консервативная):
* сигнал считается на закрытии бара, вход — по открытию следующего бара + проскальзывание;
* размер позиции — той же функцией, что и в живой торговле (риск % от equity, лимит маржи, шаг лота);
* SL/TP проверяются по high/low бара; если в одном баре задеты оба — считается, что первым сработал SL;
  гэп за уровень исполняется по цене открытия;
* трейлинг пересчитывается по экстремуму бара и действует со следующего бара;
* комиссия taker на вход и выход, проскальзывание на каждом рыночном исполнении,
  фандинг каждые 8 часов как издержка для любой стороны;
* дневной лимит убытка и максимум одновременно открытых позиций — как в живой торговле.
"""

from __future__ import annotations

import csv
import math
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, UTC
from pathlib import Path
from zoneinfo import ZoneInfo

import numpy as np

from .config import BacktestConfig, RiskConfig
from .models import Candles, InstrumentInfo
from .risk import RiskManager, calculate_position_size, stop_beyond_liquidation
from .stats import TradeStats, fmt_pf, max_drawdown, trade_stats
from .strategies.base import Signal, Strategy
from .trailing import trail_step

FUNDING_PERIOD_MS = 8 * 3_600_000

# Параметры контрактов OKX на случай работы без доступа к API (бэктест по CSV/синтетике)
DEFAULT_INSTRUMENTS = {
    "BTC-USDT-SWAP": InstrumentInfo("BTC-USDT-SWAP", ct_val=0.01, lot_sz="0.01", min_sz="0.01", tick_sz="0.1",
                                    max_lever=100),
    "ETH-USDT-SWAP": InstrumentInfo("ETH-USDT-SWAP", ct_val=0.1, lot_sz="0.01", min_sz="0.01", tick_sz="0.01",
                                    max_lever=100),
}


def default_instrument(inst_id: str) -> InstrumentInfo:
    return DEFAULT_INSTRUMENTS.get(inst_id) or InstrumentInfo(inst_id, ct_val=1.0, lot_sz="1", min_sz="1",
                                                              tick_sz="0.0001", max_lever=50)


@dataclass
class BTPosition:
    inst_id: str
    side: str
    entry_ts: int
    entry_price: float
    contracts: float
    ct_val: float
    stop_loss: float
    take_profit: float | None
    initial_stop: float
    atr: float
    trail_activation: float | None
    trail_distance: float | None
    entry_fee: float
    margin: float
    best_price: float
    trailing_active: bool = False
    funding: float = 0.0

    @property
    def qty(self) -> float:
        return self.contracts * self.ct_val

    @property
    def sign(self) -> int:
        return 1 if self.side == "long" else -1

    def upl(self, price: float) -> float:
        return self.sign * (price - self.entry_price) * self.qty


@dataclass
class BTTrade:
    inst_id: str
    side: str
    entry_time: str
    exit_time: str
    entry_price: float
    exit_price: float
    contracts: float
    qty: float
    gross_pnl: float
    fees: float
    funding: float
    pnl: float
    r_multiple: float
    reason: str


@dataclass
class BacktestResult:
    strategy: str
    symbols: list[str]
    timeframe: str
    start_ts: int
    end_ts: int
    initial_balance: float
    final_equity: float
    trades: list[BTTrade]
    equity_ts: list[int]
    equity: list[float]
    stats: TradeStats
    max_drawdown_pct: float
    max_drawdown_abs: float
    fees_total: float
    funding_total: float
    per_symbol: dict[str, TradeStats]
    exit_reasons: Counter
    skipped: Counter
    daily_limit_days: int
    bars: dict[str, int] = field(default_factory=dict)

    @property
    def total_return_pct(self) -> float:
        return (self.final_equity / self.initial_balance - 1) * 100


def _iso(ts_ms: int) -> str:
    return datetime.fromtimestamp(ts_ms / 1000, tz=UTC).strftime("%Y-%m-%d %H:%M")


class Backtester:
    def __init__(
        self,
        strategy: Strategy,
        instruments: dict[str, InstrumentInfo],
        risk: RiskConfig,
        bt: BacktestConfig,
        leverage: int,
        timeframe: str = "15m",
        trailing_min_step_atr: float = 0.1,
    ):
        self.strategy = strategy
        self.instruments = instruments
        self.risk = risk
        self.bt = bt
        self.leverage = leverage
        self.timeframe = timeframe
        self.trailing_min_step_atr = trailing_min_step_atr
        self.tz = ZoneInfo(risk.day_reset_timezone)
        self.risk_manager = RiskManager(risk)

    def run(self, data: dict[str, Candles]) -> BacktestResult:
        symbols = [s for s in data if len(data[s])]
        if not symbols:
            raise ValueError("Нет данных для бэктеста")
        fee = self.bt.taker_fee_pct / 100
        slip = self.bt.slippage_pct / 100
        funding_rate = self.bt.funding_rate_8h_pct / 100

        ind = {s: self.strategy.compute(data[s]) for s in symbols}
        index = {s: {int(t): i for i, t in enumerate(data[s].ts)} for s in symbols}
        timeline = sorted(set().union(*(set(int(t) for t in data[s].ts) for s in symbols)))

        balance = self.bt.initial_balance
        positions: dict[str, BTPosition] = {}
        pending: dict[str, Signal] = {}
        pending_close: set[str] = set()
        last_close: dict[str, float] = {}
        trades: list[BTTrade] = []
        equity_ts: list[int] = []
        equity: list[float] = []
        skipped: Counter = Counter()
        fees_total = funding_total = 0.0
        day_key = None
        day_start_eq = balance
        limit_hit = False
        limit_days = 0

        def mtm() -> float:
            return balance + sum(p.upl(last_close.get(s, p.entry_price)) - p.funding for s, p in positions.items())

        def close(s: str, ts: int, raw_price: float, reason: str) -> None:
            nonlocal balance, fees_total, funding_total
            p = positions.pop(s)
            exit_px = raw_price * (1 - p.sign * slip)
            gross = p.upl(exit_px)
            exit_fee = p.qty * exit_px * fee
            balance += gross - exit_fee - p.funding
            pnl = gross - p.entry_fee - exit_fee - p.funding
            fees_total += p.entry_fee + exit_fee
            funding_total += p.funding
            risk_amt = abs(p.entry_price - p.initial_stop) * p.qty
            trades.append(BTTrade(
                inst_id=s, side=p.side, entry_time=_iso(p.entry_ts), exit_time=_iso(ts),
                entry_price=p.entry_price, exit_price=exit_px, contracts=p.contracts, qty=p.qty,
                gross_pnl=gross, fees=p.entry_fee + exit_fee, funding=p.funding, pnl=pnl,
                r_multiple=pnl / risk_amt if risk_amt else 0.0, reason=reason))

        def open_(s: str, sig: Signal, ts: int, open_px: float) -> None:
            nonlocal balance
            if limit_hit:
                skipped["дневной лимит"] += 1
                return
            if len(positions) >= self.risk.max_open_positions:
                skipped["максимум позиций"] += 1
                return
            info = self.instruments[s]
            sign = 1 if sig.side == "long" else -1
            entry = open_px * (1 + sign * slip)
            sl = info.round_price(entry - sign * sig.stop_distance)
            tp = info.round_price(entry + sign * sig.take_distance) if sig.take_distance else None
            if stop_beyond_liquidation(entry, sl, self.leverage):
                skipped["стоп дальше ликвидации"] += 1
                return
            used_margin = sum(p.margin for p in positions.values())
            sizing = calculate_position_size(
                equity=mtm(), available=balance - used_margin, entry_price=entry, stop_price=sl,
                instrument=info, risk_pct=self.risk.risk_per_trade_pct, leverage=self.leverage,
                fee_rate=fee, max_margin_usage_pct=self.risk.max_margin_usage_pct)
            if not sizing.ok:
                skipped["объём меньше минимального"] += 1
                return
            if sizing.capped_by_margin:
                skipped["объём урезан по марже (вход выполнен)"] += 1
            entry_fee = sizing.qty * entry * fee
            balance -= entry_fee
            lv = sig.levels
            positions[s] = BTPosition(
                inst_id=s, side=sig.side, entry_ts=ts, entry_price=entry, contracts=sizing.contracts,
                ct_val=info.ct_val, stop_loss=sl, take_profit=tp, initial_stop=sl, atr=lv.atr,
                trail_activation=lv.trail_activation, trail_distance=lv.trail_distance,
                entry_fee=entry_fee, margin=sizing.margin, best_price=entry)
            # комиссию входа учитываем в fees_total при закрытии

        for ts in timeline:
            key = datetime.fromtimestamp(ts / 1000, self.tz).date()
            if key != day_key:
                day_key, day_start_eq, limit_hit = key, mtm(), False
            for s in symbols:
                i = index[s].get(ts)
                if i is None:
                    continue
                c = data[s]
                o, h, low, cl = float(c.open[i]), float(c.high[i]), float(c.low[i]), float(c.close[i])

                if s in pending_close and s in positions:
                    close(s, ts, o, "opposite_signal")
                pending_close.discard(s)
                if s in pending:
                    sig = pending.pop(s)
                    if s not in positions:
                        open_(s, sig, ts, o)

                p = positions.get(s)
                if p is not None:
                    if ts % FUNDING_PERIOD_MS == 0 and p.entry_ts < ts:
                        p.funding += p.qty * o * funding_rate
                    hit = self._exit_hit(p, o, h, low)
                    if hit is not None:
                        close(s, ts, *hit)
                    else:
                        self._trail(p, h, low)

                last_close[s] = cl
                sig = self.strategy.signal_at(c, ind[s], i)
                if sig is not None:
                    p = positions.get(s)
                    if p is None:
                        pending[s] = sig
                    elif p.side != sig.side and self.risk.close_on_opposite_signal:
                        pending_close.add(s)
                        pending[s] = sig
                    else:
                        skipped["позиция уже открыта"] += 1

            eq = mtm()
            equity_ts.append(ts)
            equity.append(eq)
            if not limit_hit and self.risk_manager.daily_limit_reached(day_start_eq, eq):
                limit_hit = True
                limit_days += 1

        for s in list(positions):
            close(s, timeline[-1], last_close[s], "end_of_data")
        if equity:
            equity[-1] = balance

        pnls = [t.pnl for t in trades]
        dd_abs, dd_pct = max_drawdown([self.bt.initial_balance, *equity])
        per_symbol = {s: trade_stats([t.pnl for t in trades if t.inst_id == s]) for s in symbols}
        return BacktestResult(
            strategy=self.strategy.name, symbols=symbols, timeframe=self.timeframe,
            start_ts=timeline[0], end_ts=timeline[-1], initial_balance=self.bt.initial_balance,
            final_equity=balance, trades=trades, equity_ts=equity_ts, equity=equity,
            stats=trade_stats(pnls, self.bt.initial_balance), max_drawdown_pct=dd_pct, max_drawdown_abs=dd_abs,
            fees_total=fees_total, funding_total=funding_total, per_symbol=per_symbol,
            exit_reasons=Counter(t.reason for t in trades), skipped=skipped, daily_limit_days=limit_days,
            bars={s: len(data[s]) for s in symbols})

    @staticmethod
    def _exit_hit(p: BTPosition, o: float, h: float, low: float) -> tuple[float, str] | None:
        stop_reason = "trailing_stop" if p.trailing_active else "stop_loss"
        if p.side == "long":
            if o <= p.stop_loss:
                return o, stop_reason
            if p.take_profit is not None and o >= p.take_profit:
                return o, "take_profit"
            if low <= p.stop_loss:
                return p.stop_loss, stop_reason
            if p.take_profit is not None and h >= p.take_profit:
                return p.take_profit, "take_profit"
        else:
            if o >= p.stop_loss:
                return o, stop_reason
            if p.take_profit is not None and o <= p.take_profit:
                return o, "take_profit"
            if h >= p.stop_loss:
                return p.stop_loss, stop_reason
            if p.take_profit is not None and low <= p.take_profit:
                return p.take_profit, "take_profit"
        return None

    def _trail(self, p: BTPosition, h: float, low: float) -> None:
        info = self.instruments[p.inst_id]
        step = trail_step(
            side=p.side, entry=p.entry_price, stop=p.stop_loss, best=p.best_price, active=p.trailing_active,
            high=h, low=low, activation=p.trail_activation, distance=p.trail_distance, atr=p.atr,
            tick=info.tick_size, min_step_atr=self.trailing_min_step_atr, round_price=info.round_price)
        p.best_price, p.trailing_active = step.best_price, step.active
        if step.new_stop is not None:
            p.stop_loss = step.new_stop


# ---------------- отчёт ----------------

EXIT_NAMES = {"take_profit": "тейк-профит", "stop_loss": "стоп-лосс", "trailing_stop": "трейлинг-стоп",
              "opposite_signal": "встречный сигнал", "end_of_data": "конец данных"}


def format_report(r: BacktestResult, source: str = "") -> str:
    s = r.stats
    longs = sum(1 for t in r.trades if t.side == "long")
    avg_r = float(np.mean([t.r_multiple for t in r.trades])) if r.trades else 0.0
    lines = [
        "=" * 72,
        f"БЭКТЕСТ: {r.strategy} | {', '.join(r.symbols)} | {r.timeframe}",
        f"Период: {_iso(r.start_ts)} → {_iso(r.end_ts)} UTC"
        + (f" ({', '.join(f'{k}: {v} баров' for k, v in r.bars.items())})" if r.bars else ""),
    ]
    if source:
        lines.append(f"Данные: {source}")
    lines += [
        "-" * 72,
        f"Начальный баланс:      {r.initial_balance:,.2f} USDT",
        f"Итоговый баланс:       {r.final_equity:,.2f} USDT",
        f"Итоговая доходность:   {r.total_return_pct:+.2f}%  (после комиссий, проскальзывания и фандинга)",
        f"Число сделок:          {s.trades}  (лонг {longs} / шорт {s.trades - longs})",
        f"Винрейт:               {s.win_rate:.1f}%  ({s.wins} прибыльных / {s.losses} убыточных)",
        f"Профит-фактор:         {fmt_pf(s.profit_factor)}",
        f"Макс. просадка:        {r.max_drawdown_pct:.2f}%  ({r.max_drawdown_abs:,.2f} USDT, по equity с открытыми "
        f"позициями)",
        f"Средняя сделка:        {s.avg_trade:+,.2f} USDT ({avg_r:+.2f}R); прибыль {s.avg_win:+,.2f} / "
        f"убыток {s.avg_loss:+,.2f}",
        f"Лучшая / худшая:       {s.best:+,.2f} / {s.worst:+,.2f} USDT; серия убытков: {s.max_consecutive_losses}",
        f"Комиссии:              {r.fees_total:,.2f} USDT; фандинг: {r.funding_total:,.2f} USDT",
        "Выходы:                " + (", ".join(f"{EXIT_NAMES.get(k, k)} {v}" for k, v in r.exit_reasons.most_common())
                                     or "—"),
        f"Дней с дневным лимитом: {r.daily_limit_days}",
    ]
    if r.skipped:
        lines.append("Пропущенные сигналы:   " + ", ".join(f"{k} {v}" for k, v in r.skipped.most_common()))
    lines.append("По инструментам:")
    for sym, st in r.per_symbol.items():
        lines.append(f"  {sym:<16} сделок {st.trades:>4}, винрейт {st.win_rate:5.1f}%, "
                     f"PF {fmt_pf(st.profit_factor):>5}, PnL {st.net_pnl:+,.2f} USDT")
    lines.append("=" * 72)
    return "\n".join(lines)


def save_report(r: BacktestResult, text: str, reports_dir: str) -> dict[str, Path]:
    out = Path(reports_dir)
    out.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    paths = {
        "report": out / f"backtest_{stamp}.txt",
        "trades": out / f"backtest_{stamp}_trades.csv",
        "equity": out / f"backtest_{stamp}_equity.csv",
    }
    paths["report"].write_text(text + "\n", encoding="utf-8")
    with paths["trades"].open("w", newline="", encoding="utf-8") as fh:
        fields = list(BTTrade.__dataclass_fields__)
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for t in r.trades:
            w.writerow(asdict(t))
    with paths["equity"].open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["time", "equity"])
        step = max(1, len(r.equity) // 5000)
        for ts, eq in list(zip(r.equity_ts, r.equity, strict=True))[::step]:
            w.writerow([_iso(ts), f"{eq:.4f}"])
    return paths


# ---------------- данные ----------------

def save_candles_csv(c: Candles, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["ts", "open", "high", "low", "close", "volume"])
        for row in zip(c.ts, c.open, c.high, c.low, c.close, c.volume, strict=True):
            w.writerow([int(row[0]), *(repr(float(x)) for x in row[1:])])


def load_candles_csv(path: Path) -> Candles:
    rows = []
    with Path(path).open(encoding="utf-8") as fh:
        for rec in csv.DictReader(fh):
            ts_raw = rec.get("ts") or rec.get("timestamp") or rec.get("time")
            if ts_raw is None:
                raise ValueError(f"{path}: нужна колонка ts (мс) или timestamp/time")
            try:
                ts = int(float(ts_raw))
                if ts < 10**11:  # секунды → мс
                    ts *= 1000
            except ValueError:
                ts = int(datetime.fromisoformat(ts_raw).replace(tzinfo=UTC).timestamp() * 1000)
            rows.append([ts, rec["open"], rec["high"], rec["low"], rec["close"], rec.get("volume") or 0])
    return Candles.from_rows(rows)


def synthetic_candles(inst_id: str, start_ms: int, bars: int, tf_ms: int, seed: int = 42,
                      start_price: float | None = None) -> Candles:
    """Синтетический рынок (тренды, флэт, кластеры волатильности) — только для проверки механики
    бэктеста без доступа к бирже. Ничего не говорит о реальной доходности стратегии."""
    rng = np.random.default_rng(seed)
    price = start_price or {"BTC-USDT-SWAP": 60_000.0, "ETH-USDT-SWAP": 3_000.0}.get(inst_id, 100.0)
    base_vol = 0.0022 if inst_id.startswith("BTC") else 0.003
    regime_drift = 0.0
    log_vol = 0.0
    rows = []
    for k in range(bars):
        if rng.random() < 1 / 400:
            regime_drift = rng.choice([-1.0, 0.0, 0.0, 1.0]) * base_vol * rng.uniform(0.03, 0.12)
        log_vol = 0.97 * log_vol + rng.normal(0, 0.12)
        vol = base_vol * math.exp(max(-1.0, min(1.5, log_vol)))
        o = price
        c = o * math.exp(regime_drift + rng.normal(0, vol))
        h = max(o, c) * math.exp(abs(rng.normal(0, vol * 0.6)))
        low = min(o, c) * math.exp(-abs(rng.normal(0, vol * 0.6)))
        rows.append([start_ms + k * tf_ms, o, h, low, c, rng.uniform(100, 1000)])
        price = c
    return Candles.from_rows(rows)
