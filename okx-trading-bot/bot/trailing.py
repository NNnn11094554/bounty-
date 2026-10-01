"""Правило трейлинг-стопа — одно для живой торговли и бэктеста."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class TrailStep:
    best_price: float
    active: bool
    activated_now: bool
    new_stop: float | None  # None — стоп не двигаем


def trail_step(
    *,
    side: str,
    entry: float,
    stop: float,
    best: float,
    active: bool,
    high: float,
    low: float,
    activation: float | None,
    distance: float | None,
    atr: float,
    tick: float,
    min_step_atr: float,
    round_price: Callable[[float], float],
) -> TrailStep:
    """Обновить лучшую цену и рассчитать новый стоп.

    Трейлинг включается, когда лучшая цена ушла от входа на `activation`; стоп держится на
    `distance` от лучшей цены и двигается только в сторону прибыли, не чаще чем на
    min_step_atr * ATR (первый перенос — при любом улучшении).
    """
    long = side == "long"
    best = max(best or high, high) if long else min(best or low, low)
    if activation is None or distance is None:
        return TrailStep(best, active, False, None)
    activated_now = False
    if not active:
        moved = best - entry if long else entry - best
        if moved < activation:
            return TrailStep(best, False, False, None)
        active = activated_now = True
    sign = 1 if long else -1
    candidate = round_price(best - sign * distance)
    min_step = tick / 2 if activated_now else max(tick, min_step_atr * (atr or 0.0))
    if (candidate - stop) * sign < min_step:
        return TrailStep(best, active, activated_now, None)
    return TrailStep(best, active, activated_now, candidate)
