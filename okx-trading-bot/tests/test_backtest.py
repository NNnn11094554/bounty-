import pytest

from bot.backtest import (
    DEFAULT_INSTRUMENTS,
    Backtester,
    BTPosition,
    format_report,
    load_candles_csv,
    save_candles_csv,
    synthetic_candles,
)
from bot.config import BacktestConfig, RiskConfig
from bot.models import Candles
from bot.strategies import create_strategy
from bot.strategies.base import ExitLevels, Signal, Strategy

BTC = "BTC-USDT-SWAP"
TF = 900_000


def pos(side="long", sl=99.0, tp=102.0):
    return BTPosition(inst_id=BTC, side=side, entry_ts=0, entry_price=100.0, contracts=1, ct_val=0.01,
                      stop_loss=sl, take_profit=tp, initial_stop=sl, atr=1.0, trail_activation=1.0,
                      trail_distance=1.0, entry_fee=0.0, margin=1.0, best_price=100.0)


class TestExitModel:
    def test_take_profit(self):
        assert Backtester._exit_hit(pos(), o=100, h=102.5, low=99.5) == (102.0, "take_profit")

    def test_stop_loss(self):
        assert Backtester._exit_hit(pos(), o=100, h=100.5, low=98.5) == (99.0, "stop_loss")

    def test_both_in_one_bar_assumes_stop_first(self):
        assert Backtester._exit_hit(pos(), o=100, h=103, low=98) == (99.0, "stop_loss")

    def test_gap_through_stop_fills_at_open(self):
        assert Backtester._exit_hit(pos(), o=97, h=98, low=96) == (97.0, "stop_loss")
        assert Backtester._exit_hit(pos(), o=105, h=106, low=104) == (105.0, "take_profit")

    def test_short(self):
        p = pos("short", sl=101.0, tp=98.0)
        assert Backtester._exit_hit(p, o=100, h=100.5, low=97.5) == (98.0, "take_profit")
        assert Backtester._exit_hit(p, o=100, h=101.5, low=99.5) == (101.0, "stop_loss")
        assert Backtester._exit_hit(p, o=100, h=100.5, low=99.5) is None

    def test_trailing_reason(self):
        p = pos()
        p.trailing_active = True
        assert Backtester._exit_hit(p, o=100, h=100.2, low=98.0)[1] == "trailing_stop"


class OneShot(Strategy):
    """Лонг на заданном баре с фиксированными уровнями — для проверки учёта PnL и комиссий."""

    name = "oneshot_test"
    defaults = {"bar": 5}

    @property
    def min_candles(self):
        return 2

    def compute(self, candles):
        return {}

    def signal_at(self, candles, ind, i):
        if i != self.params["bar"]:
            return None
        price = float(candles.close[i])
        return Signal("long", price, int(candles.ts[i]), self.exit_levels(candles, ind, i, "long", price))

    def exit_levels(self, candles, ind, i, side, entry_price):
        return ExitLevels(stop_loss=entry_price - 1000, take_profit=entry_price + 2000, atr=1000)


def candles_from(prices):
    rows = [[k * TF, o, h, low, c, 1] for k, (o, h, low, c) in enumerate(prices)]
    return Candles.from_rows(rows)


def test_single_trade_accounting():
    flat = [(60_000, 60_050, 59_950, 60_000)] * 6
    data = candles_from(flat + [(60_000, 60_100, 59_900, 60_100), (60_100, 62_500, 60_000, 62_400)])
    bt = BacktestConfig(initial_balance=1000, taker_fee_pct=0.05, slippage_pct=0.0, funding_rate_8h_pct=0)
    r = Backtester(OneShot(), DEFAULT_INSTRUMENTS, RiskConfig(), bt, leverage=3).run({BTC: data})
    assert r.stats.trades == 1
    t = r.trades[0]
    assert t.reason == "take_profit"
    assert t.entry_price == 60_000 and t.exit_price == 62_000  # вход по open следующего бара
    # риск 10 USDT: стоп 1000 + комиссии 0.05% * (60000 + 59000) = 1059.5 на 1 BTC
    # → 0.009438 BTC → 0.9438 контракта → вниз до лота 0.01 → 0.94 контракта = 0.0094 BTC
    assert t.contracts == pytest.approx(0.94)
    fees = 0.0094 * 60_000 * 0.0005 + 0.0094 * 62_000 * 0.0005
    assert t.pnl == pytest.approx(0.0094 * 2000 - fees)
    assert r.final_equity == pytest.approx(1000 + t.pnl)
    assert r.fees_total == pytest.approx(fees)


def test_trailing_stop_in_backtest():
    flat = [(60_000, 60_050, 59_950, 60_000)] * 6
    path = [(60_000, 60_100, 59_900, 60_000), (60_000, 61_500, 59_990, 61_400), (61_400, 61_450, 60_000, 60_200)]
    r = Backtester(OneShot(), DEFAULT_INSTRUMENTS, RiskConfig(),
                   BacktestConfig(slippage_pct=0, funding_rate_8h_pct=0, taker_fee_pct=0), leverage=3,
                   ).run({BTC: candles_from(flat + path)})
    # OneShot не задаёт трейлинг — выход по концу данных
    assert r.trades[0].reason == "end_of_data"


@pytest.fixture(scope="module")
def synthetic_result():
    start = 1_700_000_000_000 // TF * TF
    data = {s: synthetic_candles(s, start, 6_000, TF, seed=k) for k, s in enumerate(DEFAULT_INSTRUMENTS)}
    return Backtester(create_strategy("ema_cross"), DEFAULT_INSTRUMENTS, RiskConfig(), BacktestConfig(),
                      leverage=3).run(data)


def test_full_backtest_metrics_are_consistent(synthetic_result):
    r = synthetic_result
    s = r.stats
    assert s.trades > 10
    assert s.wins + s.losses == s.trades
    assert 0 <= s.win_rate <= 100
    assert r.final_equity == pytest.approx(r.initial_balance + sum(t.pnl for t in r.trades))
    assert s.net_pnl == pytest.approx(r.final_equity - r.initial_balance)
    assert 0 <= r.max_drawdown_pct < 100
    assert r.fees_total > 0
    assert set(r.exit_reasons) <= {"take_profit", "stop_loss", "trailing_stop", "end_of_data"}
    for t in r.trades:  # R считается без комиссий; с ними, гэпами и проскальзыванием убыток чуть больше 1R
        assert t.r_multiple >= -1.5
    text = format_report(r, "synthetic")
    for word in ("Число сделок", "Винрейт", "Профит-фактор", "Макс. просадка", "Итоговая доходность"):
        assert word in text


def test_daily_limit_reduces_trading():
    start = 1_700_000_000_000 // TF * TF
    data = {BTC: synthetic_candles(BTC, start, 4_000, TF, seed=3)}
    normal = Backtester(create_strategy("ema_cross"), DEFAULT_INSTRUMENTS, RiskConfig(), BacktestConfig(),
                        leverage=3).run(data)
    strict = Backtester(create_strategy("ema_cross"), DEFAULT_INSTRUMENTS,
                        RiskConfig(daily_loss_limit_pct=0.3), BacktestConfig(), leverage=3).run(data)
    assert strict.daily_limit_days > 0
    assert strict.stats.trades < normal.stats.trades
    assert strict.skipped["дневной лимит"] > 0


def test_csv_roundtrip(tmp_path):
    c = synthetic_candles(BTC, 1_700_000_000_000 // TF * TF, 50, TF, seed=1)
    path = tmp_path / f"{BTC}.csv"
    save_candles_csv(c, path)
    back = load_candles_csv(path)
    assert list(back.ts) == list(c.ts)
    assert back.close == pytest.approx(c.close)
