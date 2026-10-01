"""Статистика по сделкам — общая для /report и бэктеста."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class TradeStats:
    trades: int
    wins: int
    losses: int
    win_rate: float  # %
    profit_factor: float  # inf, если убыточных сделок нет
    net_pnl: float
    gross_profit: float
    gross_loss: float
    avg_trade: float
    avg_win: float
    avg_loss: float
    best: float
    worst: float
    max_consecutive_losses: int
    max_drawdown: float  # USDT, по кривой закрытых сделок
    max_drawdown_pct: float  # % от пика (если известен стартовый капитал)


def max_drawdown(equity: Sequence[float]) -> tuple[float, float]:
    """Максимальная просадка (абсолютная, в % от пика)."""
    peak = -math.inf
    dd_abs = dd_pct = 0.0
    for v in equity:
        peak = max(peak, v)
        dd = peak - v
        dd_abs = max(dd_abs, dd)
        if peak > 0:
            dd_pct = max(dd_pct, dd / peak * 100.0)
    return dd_abs, dd_pct


def trade_stats(pnls: Sequence[float], initial_equity: float | None = None) -> TradeStats:
    wins = [p for p in pnls if p > 0]
    losses = [p for p in pnls if p <= 0]
    gross_profit = sum(wins)
    gross_loss = -sum(losses)
    if gross_loss > 0:
        pf = gross_profit / gross_loss
    else:
        pf = math.inf if gross_profit > 0 else 0.0
    streak = max_streak = 0
    for p in pnls:
        streak = streak + 1 if p <= 0 else 0
        max_streak = max(max_streak, streak)
    start = initial_equity if initial_equity is not None else 0.0
    curve = [start]
    for p in pnls:
        curve.append(curve[-1] + p)
    dd_abs, dd_pct = max_drawdown(curve)
    n = len(pnls)
    return TradeStats(
        trades=n,
        wins=len(wins),
        losses=len(losses),
        win_rate=len(wins) / n * 100.0 if n else 0.0,
        profit_factor=pf,
        net_pnl=sum(pnls),
        gross_profit=gross_profit,
        gross_loss=gross_loss,
        avg_trade=sum(pnls) / n if n else 0.0,
        avg_win=gross_profit / len(wins) if wins else 0.0,
        avg_loss=-gross_loss / len(losses) if losses else 0.0,
        best=max(pnls) if pnls else 0.0,
        worst=min(pnls) if pnls else 0.0,
        max_consecutive_losses=max_streak,
        max_drawdown=dd_abs,
        max_drawdown_pct=dd_pct if initial_equity else 0.0,
    )


def fmt_pf(pf: float) -> str:
    return "∞" if math.isinf(pf) else f"{pf:.2f}"
