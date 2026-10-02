"""Индикаторы. Все функции причинные: значение в i зависит только от данных <= i.

До набора истории возвращается NaN.
"""

from __future__ import annotations

import numpy as np


def _as_float(values) -> np.ndarray:
    return np.asarray(values, dtype=float)


def ema(values, period: int) -> np.ndarray:
    """Экспоненциальная средняя, alpha = 2/(period+1), старт — SMA первых period значений."""
    if period < 1:
        raise ValueError("period >= 1")
    x = _as_float(values)
    out = np.full(len(x), np.nan)
    if len(x) < period:
        return out
    alpha = 2.0 / (period + 1)
    prev = float(x[:period].mean())
    out[period - 1] = prev
    for i in range(period, len(x)):
        prev = alpha * x[i] + (1 - alpha) * prev
        out[i] = prev
    return out


def rma(values, period: int) -> np.ndarray:
    """Сглаживание Уайлдера (RMA), старт — SMA первых period значений."""
    x = _as_float(values)
    out = np.full(len(x), np.nan)
    if len(x) < period:
        return out
    prev = float(x[:period].mean())
    out[period - 1] = prev
    for i in range(period, len(x)):
        prev = (prev * (period - 1) + x[i]) / period
        out[i] = prev
    return out


def rsi(close, period: int = 14) -> np.ndarray:
    """RSI по Уайлдеру. Первое значение — в индексе period."""
    c = _as_float(close)
    out = np.full(len(c), np.nan)
    if len(c) <= period:
        return out
    delta = np.diff(c)
    gains = np.clip(delta, 0, None)
    losses = np.clip(-delta, 0, None)
    avg_gain = rma(gains, period)
    avg_loss = rma(losses, period)
    with np.errstate(divide="ignore", invalid="ignore"):
        rs = avg_gain / avg_loss
        values = 100.0 - 100.0 / (1.0 + rs)
    values = np.where((avg_loss == 0) & (avg_gain > 0), 100.0, values)
    values = np.where((avg_loss == 0) & (avg_gain == 0), 50.0, values)
    out[1:] = values
    return out


def true_range(high, low, close) -> np.ndarray:
    h, lo, c = _as_float(high), _as_float(low), _as_float(close)
    tr = h - lo
    if len(c) > 1:
        prev = c[:-1]
        tr[1:] = np.maximum.reduce([h[1:] - lo[1:], np.abs(h[1:] - prev), np.abs(lo[1:] - prev)])
    return tr


def atr(high, low, close, period: int = 14) -> np.ndarray:
    """Average True Range по Уайлдеру."""
    return rma(true_range(high, low, close), period)
