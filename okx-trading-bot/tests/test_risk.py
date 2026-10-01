import pytest

from bot.config import RiskConfig
from bot.models import InstrumentInfo
from bot.risk import RiskManager, calculate_position_size, stop_beyond_liquidation

BTC = InstrumentInfo("BTC-USDT-SWAP", ct_val=0.01, lot_sz="0.01", min_sz="0.01", tick_sz="0.1")
ETH = InstrumentInfo("ETH-USDT-SWAP", ct_val=0.1, lot_sz="0.01", min_sz="0.01", tick_sz="0.01")


def size(**kw):
    params = dict(equity=1000.0, available=1000.0, entry_price=60_000.0, stop_price=59_100.0, instrument=BTC,
                  risk_pct=1.0, leverage=3, fee_rate=0.0, max_margin_usage_pct=90.0)
    params.update(kw)
    return calculate_position_size(**params)


class TestPositionSize:
    def test_risk_one_percent_without_fees(self):
        # риск 10 USDT, стоп 900 → 0.01111 BTC → 1.111 контракта → округление вниз до 1.11
        r = size()
        assert r.ok
        assert r.contracts == pytest.approx(1.11)
        assert r.qty == pytest.approx(0.0111)
        assert r.target_risk == pytest.approx(10.0)
        assert r.risk_amount == pytest.approx(0.0111 * 900)
        assert r.risk_amount <= r.target_risk
        assert r.notional == pytest.approx(0.0111 * 60_000)
        assert r.margin == pytest.approx(r.notional / 3)
        assert not r.capped_by_margin

    def test_fees_reduce_size_and_are_included_in_risk(self):
        r = size(fee_rate=0.0005)
        loss_per_coin = 900 + 0.0005 * (60_000 + 59_100)  # 959.55
        assert r.contracts == pytest.approx(1.04)  # 10 / 959.55 / 0.01 = 1.0422
        assert r.risk_amount == pytest.approx(r.qty * loss_per_coin)
        assert 9.9 < r.risk_amount <= 10.0

    def test_short_position_symmetric(self):
        long = size(stop_price=59_100.0)
        short = size(stop_price=60_900.0)
        assert short.contracts == long.contracts

    def test_risk_scales_with_equity_and_percent(self):
        assert size(equity=2000).contracts == pytest.approx(2.22)
        assert size(risk_pct=2.0).contracts == pytest.approx(2.22)

    def test_rounds_down_to_lot_size(self):
        coarse = InstrumentInfo("X-USDT-SWAP", ct_val=0.01, lot_sz="0.1", min_sz="0.1", tick_sz="0.1")
        r = size(instrument=coarse)
        assert r.contracts == pytest.approx(1.1)
        integer_lot = InstrumentInfo("Y-USDT-SWAP", ct_val=0.01, lot_sz="1", min_sz="1", tick_sz="0.1")
        assert size(instrument=integer_lot).contracts == 1.0

    def test_below_minimum_contract_is_rejected(self):
        big_min = InstrumentInfo("X-USDT-SWAP", ct_val=0.01, lot_sz="1", min_sz="1", tick_sz="0.1")
        r = size(equity=50.0, instrument=big_min)  # риск 0.5 USDT → 0.055 контракта < 1
        assert not r.ok
        assert r.contracts == 0
        assert "минимального" in r.reason

    def test_margin_cap(self):
        # свободно 100 USDT → под позицию 90 USDT маржи при 3x ≈ 270 USDT номинала
        r = size(available=100.0)
        assert r.ok and r.capped_by_margin
        assert r.margin <= 90.0 + 1e-9
        assert r.notional <= 270.0 + 1e-9
        assert r.risk_amount < r.target_risk

    def test_no_margin_at_all(self):
        r = size(available=0.0)
        assert not r.ok
        assert "маржи" in r.reason

    def test_eth_contract_value(self):
        # ETH: ctVal 0.1, вход 3000, стоп 2955 (45) → 10/45 = 0.2222 ETH = 2.222 контракта
        r = size(instrument=ETH, entry_price=3000.0, stop_price=2955.0)
        assert r.contracts == pytest.approx(2.22)

    def test_max_market_size(self):
        limited = InstrumentInfo("X-USDT-SWAP", ct_val=0.01, lot_sz="0.01", min_sz="0.01", tick_sz="0.1",
                                 max_mkt_sz=0.5)
        assert size(instrument=limited).contracts == pytest.approx(0.5)

    @pytest.mark.parametrize("kw", [dict(equity=0), dict(equity=-5), dict(stop_price=60_000.0),
                                    dict(entry_price=0), dict(leverage=0)])
    def test_invalid_inputs(self, kw):
        r = size(**kw)
        assert not r.ok and r.reason


class TestInstrumentPrecision:
    def test_price_rounding_and_format(self):
        assert BTC.round_price(60_123.456) == pytest.approx(60_123.5)
        assert BTC.round_price(60_123.44) == pytest.approx(60_123.4)
        assert BTC.fmt_price(60_123.456) == "60123.5"
        assert ETH.fmt_price(3000.0) == "3000.00"
        assert ETH.round_price(3000.019, "down") == pytest.approx(3000.01)
        assert ETH.round_price(3000.011, "up") == pytest.approx(3000.02)

    def test_size_rounding_no_float_artifacts(self):
        assert BTC.round_size_down(0.03) == pytest.approx(0.03)
        assert BTC.round_size_down(1.1199999) == pytest.approx(1.11)
        assert BTC.fmt_size(1.1) == "1.10"
        assert BTC.round_size_down(-1) == 0.0
        assert BTC.round_size_down(float("nan")) == 0.0


def test_stop_beyond_liquidation():
    assert not stop_beyond_liquidation(60_000, 59_100, leverage=3)  # 1.5% при 3x
    assert stop_beyond_liquidation(60_000, 40_000, leverage=3)  # 33% — дальше ликвидации
    assert stop_beyond_liquidation(60_000, 59_000, leverage=100)  # 1.7% при 100x


class TestRiskManager:
    rm = RiskManager(RiskConfig())

    def test_allowed(self):
        d = self.rm.check_entry(inst_id="BTC", open_inst_ids=set(), paused=False, daily_limit_hit=False)
        assert d.allowed

    def test_paused(self):
        d = self.rm.check_entry(inst_id="BTC", open_inst_ids=set(), paused=True, daily_limit_hit=False)
        assert not d.allowed and "пауз" in d.reason

    def test_daily_limit(self):
        d = self.rm.check_entry(inst_id="BTC", open_inst_ids=set(), paused=False, daily_limit_hit=True)
        assert not d.allowed and "дневной" in d.reason

    def test_no_duplicates(self):
        d = self.rm.check_entry(inst_id="BTC", open_inst_ids={"BTC"}, paused=False, daily_limit_hit=False)
        assert not d.allowed and "уже есть" in d.reason

    def test_max_open_positions(self):
        d = self.rm.check_entry(inst_id="SOL", open_inst_ids={"BTC", "ETH"}, paused=False, daily_limit_hit=False)
        assert not d.allowed and "максимум" in d.reason
        rm1 = RiskManager(RiskConfig(max_open_positions=3))
        assert rm1.check_entry(inst_id="SOL", open_inst_ids={"BTC", "ETH"}, paused=False,
                               daily_limit_hit=False).allowed

    def test_daily_loss_limit_threshold(self):
        assert self.rm.daily_limit_reached(1000, 950)  # ровно -5%
        assert self.rm.daily_limit_reached(1000, 900)
        assert not self.rm.daily_limit_reached(1000, 950.01)
        assert not self.rm.daily_limit_reached(1000, 1100)
        assert not self.rm.daily_limit_reached(0, 100)
        assert self.rm.daily_pnl_pct(1000, 970) == pytest.approx(-3.0)
