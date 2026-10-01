"""EMA 9/21 crossover с фильтром тренда EMA 200 и RSI, выходы по ATR.

Лонг:  EMA fast пересекает EMA slow снизу вверх, close > EMA trend, RSI < rsi_long_max.
Шорт:  EMA fast пересекает EMA slow сверху вниз, close < EMA trend, RSI > rsi_short_min.
Стоп:  sl_atr * ATR от входа, тейк: tp_atr * ATR.
Трейлинг включается после движения на trailing_activation_atr * ATR в плюс
и держится на trailing_distance_atr * ATR от лучшей цены.
"""

from __future__ import annotations

import math

from ..indicators import atr, ema, rsi
from ..models import Candles, Side
from . import register
from .base import ExitLevels, Indicators, Signal, Strategy


@register
class EmaCrossStrategy(Strategy):
    name = "ema_cross"
    defaults = {
        "ema_fast": 9,
        "ema_slow": 21,
        "ema_trend": 200,
        "rsi_period": 14,
        "rsi_long_max": 70.0,
        "rsi_short_min": 30.0,
        "atr_period": 14,
        "sl_atr": 1.5,
        "tp_atr": 3.0,
        "trailing_activation_atr": 1.0,
        "trailing_distance_atr": 1.0,
    }

    def validate(self) -> None:
        p = self.params
        if not 0 < p["ema_fast"] < p["ema_slow"]:
            raise ValueError("ema_cross: нужно 0 < ema_fast < ema_slow")
        if p["sl_atr"] <= 0 or p["tp_atr"] <= 0:
            raise ValueError("ema_cross: sl_atr и tp_atr должны быть > 0")
        if not 0 <= p["rsi_short_min"] <= 100 or not 0 <= p["rsi_long_max"] <= 100:
            raise ValueError("ema_cross: пороги RSI в диапазоне 0..100")

    @property
    def min_candles(self) -> int:
        p = self.params
        return max(p["ema_trend"], p["ema_slow"] + 1, p["rsi_period"] + 2, p["atr_period"] + 1)

    def compute(self, candles: Candles) -> Indicators:
        p = self.params
        return {
            "ema_fast": ema(candles.close, p["ema_fast"]),
            "ema_slow": ema(candles.close, p["ema_slow"]),
            "ema_trend": ema(candles.close, p["ema_trend"]),
            "rsi": rsi(candles.close, p["rsi_period"]),
            "atr": atr(candles.high, candles.low, candles.close, p["atr_period"]),
        }

    def signal_at(self, candles: Candles, ind: Indicators, i: int) -> Signal | None:
        if i < 1 or i >= len(candles):
            return None
        f, s, t, r, a = ind["ema_fast"], ind["ema_slow"], ind["ema_trend"], ind["rsi"], ind["atr"]
        values = (f[i - 1], s[i - 1], f[i], s[i], t[i], r[i], a[i])
        if any(math.isnan(v) for v in values) or a[i] <= 0:
            return None
        p = self.params
        close = float(candles.close[i])
        crossed_up = f[i - 1] <= s[i - 1] and f[i] > s[i]
        crossed_down = f[i - 1] >= s[i - 1] and f[i] < s[i]
        side: Side | None = None
        if crossed_up and close > t[i] and r[i] < p["rsi_long_max"]:
            side = "long"
        elif crossed_down and close < t[i] and r[i] > p["rsi_short_min"]:
            side = "short"
        if side is None:
            return None
        reason = (f"EMA{p['ema_fast']} {'↑' if side == 'long' else '↓'} EMA{p['ema_slow']}, "
                  f"close {close:.6g} {'>' if side == 'long' else '<'} EMA{p['ema_trend']} {t[i]:.6g}, "
                  f"RSI {r[i]:.1f}, ATR {a[i]:.6g}")
        return Signal(side=side, price=close, ts=int(candles.ts[i]),
                      levels=self.exit_levels(candles, ind, i, side, close), reason=reason)

    def exit_levels(self, candles: Candles, ind: Indicators, i: int, side: Side, entry_price: float) -> ExitLevels:
        p = self.params
        a = float(ind["atr"][i])
        sign = 1 if side == "long" else -1
        return ExitLevels(
            stop_loss=entry_price - sign * p["sl_atr"] * a,
            take_profit=entry_price + sign * p["tp_atr"] * a,
            atr=a,
            trail_activation=p["trailing_activation_atr"] * a if p["trailing_activation_atr"] > 0 else None,
            trail_distance=p["trailing_distance_atr"] * a if p["trailing_distance_atr"] > 0 else None,
        )
