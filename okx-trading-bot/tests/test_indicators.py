import math

import numpy as np
import pytest

from bot.indicators import atr, ema, rsi, true_range


def test_ema_linear_series():
    out = ema(np.arange(1, 11, dtype=float), 3)
    assert np.isnan(out[:2]).all()
    # старт = SMA(1,2,3) = 2; для линейного ряда EMA отстаёт ровно на 1
    assert out[2:] == pytest.approx(np.arange(2, 10, dtype=float))


def test_ema_constant_and_short():
    assert ema([5.0] * 30, 9)[8:] == pytest.approx([5.0] * 22)
    assert np.isnan(ema([1.0, 2.0], 5)).all()


def test_ema_matches_reference_loop():
    rng = np.random.default_rng(0)
    x = 100 + rng.normal(0, 1, 300).cumsum()
    period = 21
    alpha = 2 / (period + 1)
    ref = [x[:period].mean()]
    for v in x[period:]:
        ref.append(alpha * v + (1 - alpha) * ref[-1])
    assert ema(x, period)[period - 1:] == pytest.approx(ref)


def test_rsi_wilder_textbook_example():
    # классический пример (StockCharts): первое значение RSI(14) = 70.53
    closes = [44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826, 45.8931,
              46.0328, 45.6140, 46.2820, 46.2820, 46.0028, 46.0328, 46.4116, 46.2222, 45.6439]
    r = rsi(closes, 14)
    assert np.isnan(r[:14]).all()
    assert r[14:] == pytest.approx([70.53, 66.32, 66.55, 69.41, 66.36, 57.97], abs=0.01)


def test_rsi_extremes():
    assert rsi(np.arange(1, 40, dtype=float), 14)[14:] == pytest.approx(100.0)
    assert rsi(np.arange(40, 1, -1, dtype=float), 14)[14:] == pytest.approx(0.0)
    assert rsi([10.0] * 30, 14)[14:] == pytest.approx(50.0)


def test_true_range_uses_gaps():
    tr = true_range(high=[10, 12, 9], low=[9, 11, 8], close=[9.5, 11.5, 8.5])
    assert tr[0] == 1  # high - low
    assert tr[1] == pytest.approx(2.5)  # |12 - 9.5|
    assert tr[2] == pytest.approx(3.5)  # |8 - 11.5|


def test_atr_constant_range():
    n = 50
    close = np.full(n, 100.0)
    a = atr(close + 1, close - 1, close, 14)
    assert np.isnan(a[:13]).all()
    assert a[13:] == pytest.approx(2.0)
    assert not math.isnan(a[-1])
