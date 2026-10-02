import math

import numpy as np
import pytest

from bot.indicators import atr, ema, rsi
from bot.models import Candles
from bot.strategies import REGISTRY, ExitLevels, Signal, Strategy, create_strategy, register
from conftest import wave_candles


def expected_side(c: Candles, i: int, p: dict) -> str | None:
    """Независимая проверка условий стратегии по ТЗ."""
    f, s = ema(c.close, p["ema_fast"]), ema(c.close, p["ema_slow"])
    t, r = ema(c.close, p["ema_trend"]), rsi(c.close, p["rsi_period"])
    if i < 1 or any(math.isnan(v) for v in (f[i - 1], s[i - 1], f[i], s[i], t[i], r[i])):
        return None
    if f[i - 1] <= s[i - 1] and f[i] > s[i] and c.close[i] > t[i] and r[i] < p["rsi_long_max"]:
        return "long"
    if f[i - 1] >= s[i - 1] and f[i] < s[i] and c.close[i] < t[i] and r[i] > p["rsi_short_min"]:
        return "short"
    return None


@pytest.fixture
def strat():
    return create_strategy("ema_cross")


def all_signals(strategy, candles):
    ind = strategy.compute(candles)
    return {i: strategy.signal_at(candles, ind, i) for i in range(len(candles))}


def test_uptrend_gives_only_longs_matching_rules(strat):
    c = wave_candles(trend=0.0004)
    sigs = all_signals(strat, c)
    found = {i: s.side for i, s in sigs.items() if s}
    assert found, "на волнах вокруг растущего тренда должны быть сигналы"
    assert set(found.values()) == {"long"}
    for i in range(len(c)):
        assert found.get(i) == expected_side(c, i, strat.params), f"бар {i}"


def test_downtrend_gives_only_shorts_matching_rules(strat):
    c = wave_candles(trend=-0.0004)
    sigs = all_signals(strat, c)
    found = {i: s.side for i, s in sigs.items() if s}
    assert found and set(found.values()) == {"short"}
    for i in range(len(c)):
        assert found.get(i) == expected_side(c, i, strat.params)


def test_crossover_happens_exactly_on_signal_bar(strat):
    c = wave_candles(trend=0.0004)
    ind = strat.compute(c)
    f, s = ind["ema_fast"], ind["ema_slow"]
    for i, sig in all_signals(strat, c).items():
        if sig:
            assert f[i - 1] <= s[i - 1] and f[i] > s[i]
            assert c.close[i] > ind["ema_trend"][i]
            assert ind["rsi"][i] < 70


def test_trend_filter_blocks_counter_trend_crosses(strat):
    # в нисходящем тренде EMA9 тоже пересекает EMA21 снизу вверх, но лонгов быть не должно
    c = wave_candles(trend=-0.0004)
    ind = strat.compute(c)
    f, s = ind["ema_fast"], ind["ema_slow"]
    ups = [i for i in range(200, len(c)) if f[i - 1] <= s[i - 1] and f[i] > s[i]]
    assert ups, "пересечения вверх есть"
    assert all(strat.signal_at(c, ind, i) is None for i in ups)


def test_rsi_filter():
    c = wave_candles(trend=0.0004)
    assert any(all_signals(create_strategy("ema_cross"), c).values())
    blocked = create_strategy("ema_cross", {"rsi_long_max": 1})
    assert not any(all_signals(blocked, c).values())
    c_down = wave_candles(trend=-0.0004)
    blocked_short = create_strategy("ema_cross", {"rsi_short_min": 99})
    assert not any(all_signals(blocked_short, c_down).values())


def test_exit_levels_from_atr(strat):
    c = wave_candles(trend=0.0004)
    ind = strat.compute(c)
    i, sig = next((i, s) for i, s in all_signals(strat, c).items() if s)
    a = atr(c.high, c.low, c.close, 14)[i]
    assert sig.levels.atr == pytest.approx(a)
    assert sig.price == pytest.approx(c.close[i])
    assert sig.levels.stop_loss == pytest.approx(sig.price - 1.5 * a)
    assert sig.levels.take_profit == pytest.approx(sig.price + 3.0 * a)
    assert sig.levels.trail_activation == pytest.approx(1.0 * a)
    assert sig.levels.trail_distance == pytest.approx(1.0 * a)
    assert sig.stop_distance * 2 == pytest.approx(sig.take_distance)  # R:R 1:2
    short = strat.exit_levels(c, ind, i, "short", 100.0)
    assert short.stop_loss == pytest.approx(100 + 1.5 * a)
    assert short.take_profit == pytest.approx(100 - 3.0 * a)


def test_no_lookahead(strat):
    """Сигнал по полной истории в баре i совпадает с сигналом, посчитанным только по данным до i."""
    c = wave_candles(trend=0.0004, noise=0.002, seed=7)
    full = all_signals(strat, c)
    signal_bars = [i for i, s in full.items() if s]
    rng = np.random.default_rng(3)
    check = set(signal_bars[:5]) | set(int(x) for x in rng.integers(strat.min_candles, len(c), 15))
    for i in check:
        live = strat.generate_signal(c.slice(0, i + 1))
        assert (live is None) == (full[i] is None), f"бар {i}"
        if live:
            assert live.side == full[i].side
            assert live.levels.stop_loss == pytest.approx(full[i].levels.stop_loss)


def test_not_enough_history(strat):
    c = wave_candles(n=150)
    assert strat.generate_signal(c) is None
    assert strat.protective_levels(c, "long", 100) is None
    assert strat.min_candles == 200


def test_registry_and_validation():
    assert "ema_cross" in REGISTRY or create_strategy("ema_cross")
    with pytest.raises(ValueError, match="Неизвестная стратегия"):
        create_strategy("nope")
    with pytest.raises(ValueError, match="неизвестные параметры"):
        create_strategy("ema_cross", {"ema_fats": 9})
    with pytest.raises(ValueError):
        create_strategy("ema_cross", {"ema_fast": 30, "ema_slow": 21})


def test_custom_strategy_can_be_plugged_in():
    @register
    class AlwaysLong(Strategy):
        name = "always_long_test"
        defaults = {"stop_pct": 1.0}

        @property
        def min_candles(self):
            return 2

        def compute(self, candles):
            return {}

        def signal_at(self, candles, ind, i):
            price = float(candles.close[i])
            return Signal("long", price, int(candles.ts[i]), self.exit_levels(candles, ind, i, "long", price))

        def exit_levels(self, candles, ind, i, side, entry_price):
            d = entry_price * self.params["stop_pct"] / 100
            return ExitLevels(stop_loss=entry_price - d, take_profit=entry_price + 2 * d)

    s = create_strategy("always_long_test", {"stop_pct": 2.0})
    sig = s.generate_signal(wave_candles(n=10))
    assert sig.side == "long"
    assert sig.levels.stop_loss == pytest.approx(sig.price * 0.98)
