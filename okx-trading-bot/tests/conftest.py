from __future__ import annotations

import math
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from ccxt.base.errors import InsufficientFunds, InvalidOrder

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bot.backtest import DEFAULT_INSTRUMENTS  # noqa: E402
from bot.config import Settings  # noqa: E402
from bot.exchange import select_closed_position  # noqa: E402
from bot.models import (  # noqa: E402
    AccountConfig,
    AlgoOrder,
    Balance,
    Candles,
    OrderInfo,
    Position,
)
from bot.notifier import Notifier  # noqa: E402
from bot.storage import Storage  # noqa: E402
from bot.strategies.base import ExitLevels, Signal  # noqa: E402

BTC, ETH = "BTC-USDT-SWAP", "ETH-USDT-SWAP"
T0 = 1_760_000_400.0  # 2025-10-09 09:00:00 UTC, кратно 15 минутам


class Clock:
    def __init__(self, t: float = T0):
        self.t = t

    def __call__(self) -> float:
        return self.t

    def advance(self, seconds: float) -> None:
        self.t += seconds


class RecordingNotifier(Notifier):
    def __init__(self):
        super().__init__()
        self.messages: list[str] = []

    async def send(self, text: str) -> None:
        self.messages.append(text)

    def has(self, fragment: str) -> bool:
        return any(fragment in m for m in self.messages)


class FakeOkx:
    """Биржа в памяти с интерфейсом OkxClient (net-режим позиций, изолированная маржа)."""

    def __init__(self, cash: float = 1000.0, prices: dict | None = None, fee_rate: float = 0.0005):
        self.cash = cash
        self.fee_rate = fee_rate
        self.prices = dict(prices or {BTC: 60_000.0, ETH: 3_000.0})
        self.instruments = {k: v for k, v in DEFAULT_INSTRUMENTS.items()}
        self.positions: dict[str, dict] = {}  # inst_id -> {side, contracts, avg_px, c_time, margin}
        self.algos: dict[str, AlgoOrder] = {}
        self.orders: dict[str, OrderInfo] = {}
        self.order_cl: dict[str, str] = {}
        self.history: list[dict] = []  # записи в формате /account/positions-history
        self.history_visible = True  # False — история OKX «запаздывает»
        self.empty_positions = 0  # столько следующих запросов позиций вернут пустой список (сбой биржи)
        self.stubborn_close: dict[str, int] = {}  # сколько раз close-position «принимается», но не закрывает
        self.candles: dict[str, Candles] = {}
        self.leverage_calls: list[tuple] = []
        self.placed_orders: list[dict] = []
        self.placed_algos: list[dict] = []
        self.amends: list[dict] = []
        self.closed_calls: list[str] = []
        self.attach_algos = True
        self.fail_amend = False
        self.fail_tpsl = False
        self.insufficient_funds = 0
        self.pos_mode = "net_mode"
        self.equity_override: float | None = None
        self.clock = lambda: T0
        self._seq = 0

    @property
    def now_ms(self) -> int:
        return int(self.clock() * 1000)

    def _id(self) -> str:
        self._seq += 1
        return str(1000 + self._seq)

    # --- управление рынком в тестах ---

    def set_price(self, inst_id: str, price: float) -> None:
        self.prices[inst_id] = price

    def open_manual(self, inst_id: str, side: str, contracts: float, price: float, mgn_mode: str = "isolated"):
        info = self.instruments[inst_id]
        self.positions[inst_id] = dict(side=side, contracts=contracts, avg_px=price, c_time=self.now_ms - 3_600_000,
                                       margin=contracts * info.ct_val * price / 3, mgn_mode=mgn_mode)

    def _close(self, inst_id: str, price: float, close_type: str = "2") -> None:
        p = self.positions.pop(inst_id)
        info = self.instruments[inst_id]
        qty = p["contracts"] * info.ct_val
        sign = 1 if p["side"] == "long" else -1
        gross = sign * (price - p["avg_px"]) * qty
        fee = -qty * price * self.fee_rate
        self.cash += gross + fee
        self.history.append({"instId": inst_id, "direction": p["side"], "type": close_type,
                             "cTime": str(p["c_time"]), "uTime": str(self.now_ms), "openAvgPx": str(p["avg_px"]),
                             "closeAvgPx": str(price), "realizedPnl": str(gross + fee), "fee": str(fee),
                             "fundingFee": "0"})

    def trigger(self, inst_id: str) -> str | None:
        """Сработать TP/SL по текущей цене, как это сделала бы биржа."""
        p = self.positions.get(inst_id)
        if not p:
            return None
        price = self.prices[inst_id]
        for a in list(self.algos.values()):
            if a.inst_id != inst_id or not a.protects(p["side"]):
                continue
            long = p["side"] == "long"
            if a.sl_trigger and ((long and price <= a.sl_trigger) or (not long and price >= a.sl_trigger)):
                del self.algos[a.algo_id]
                self._close(inst_id, a.sl_trigger)
                return "sl"
            if a.tp_trigger and ((long and price >= a.tp_trigger) or (not long and price <= a.tp_trigger)):
                del self.algos[a.algo_id]
                self._close(inst_id, a.tp_trigger)
                return "tp"
        return None

    # --- интерфейс OkxClient ---

    async def close(self) -> None:
        pass

    async def load_instruments(self, inst_ids):
        return {i: self.instruments[i] for i in inst_ids}

    async def get_account_config(self):
        return AccountConfig(pos_mode=self.pos_mode, acct_lv="2")

    async def set_leverage(self, inst_id, lever, mgn_mode, pos_mode):
        self.leverage_calls.append((inst_id, lever, mgn_mode, pos_mode))

    def _upl(self) -> float:
        total = 0.0
        for inst_id, p in self.positions.items():
            sign = 1 if p["side"] == "long" else -1
            total += sign * (self.prices[inst_id] - p["avg_px"]) * p["contracts"] * self.instruments[inst_id].ct_val
        return total

    async def get_balance(self):
        equity = self.equity_override if self.equity_override is not None else self.cash + self._upl()
        used = sum(p["margin"] for p in self.positions.values())
        return Balance(equity=equity, available=self.cash - used)

    async def get_positions(self):
        if self.empty_positions > 0:
            self.empty_positions -= 1
            return []
        out = []
        for inst_id, p in self.positions.items():
            sign = 1 if p["side"] == "long" else -1
            upl = sign * (self.prices[inst_id] - p["avg_px"]) * p["contracts"] * self.instruments[inst_id].ct_val
            out.append(Position(inst_id=inst_id, side=p["side"], pos_side="net", contracts=p["contracts"],
                                avg_px=p["avg_px"], upl=upl, mark_px=self.prices[inst_id], c_time=p["c_time"],
                                mgn_mode=p.get("mgn_mode", "isolated")))
        return out

    async def fetch_candles(self, inst_id, bar, limit=600, closed_only=True):
        return self.candles[inst_id]

    async def fetch_ticker_price(self, inst_id):
        return self.prices[inst_id]

    async def place_market_order(self, *, inst_id, side, sz, td_mode, pos_side, cl_ord_id, sl_trigger=None,
                                 tp_trigger=None, attach_algo_cl_id=None, trigger_px_type="last"):
        self.placed_orders.append(dict(inst_id=inst_id, side=side, sz=sz, td_mode=td_mode, pos_side=pos_side,
                                       sl=sl_trigger, tp=tp_trigger))
        if self.insufficient_funds > 0:
            self.insufficient_funds -= 1
            raise InsufficientFunds("okx 51008 Order failed. Insufficient USDT margin in account")
        info = self.instruments[inst_id]
        contracts = float(sz)
        price = self.prices[inst_id]
        margin = contracts * info.ct_val * price / 3
        if margin > self.cash:
            raise InsufficientFunds("okx 51008")
        self.cash -= contracts * info.ct_val * price * self.fee_rate
        new_side = "long" if side == "buy" else "short"
        self.positions[inst_id] = dict(side=new_side, contracts=contracts, avg_px=price, c_time=self.now_ms,
                                       margin=margin, mgn_mode=td_mode)
        ord_id = self._id()
        self.orders[ord_id] = OrderInfo(ord_id=ord_id, state="filled", avg_px=price, filled_sz=contracts)
        self.order_cl[cl_ord_id] = ord_id
        if self.attach_algos and (sl_trigger or tp_trigger):
            algo_id = self._id()
            self.algos[algo_id] = AlgoOrder(
                algo_id=algo_id, inst_id=inst_id, side="sell" if side == "buy" else "buy", pos_side="net",
                sz=contracts, sl_trigger=float(sl_trigger) if sl_trigger else None,
                tp_trigger=float(tp_trigger) if tp_trigger else None, algo_cl_id=attach_algo_cl_id or "",
                ord_type="oco")
        return ord_id

    async def get_order(self, inst_id, ord_id=None, cl_ord_id=None):
        if ord_id is None:
            ord_id = self.order_cl.get(cl_ord_id or "")
        return self.orders.get(ord_id)

    async def cancel_order(self, inst_id, ord_id):
        pass

    async def get_pending_tpsl(self, inst_id=None):
        return [a for a in self.algos.values() if inst_id is None or a.inst_id == inst_id]

    async def place_tpsl(self, *, inst_id, close_side, pos_side, td_mode, sz, sl_trigger, tp_trigger, algo_cl_id,
                         trigger_px_type="last"):
        self.placed_algos.append(dict(inst_id=inst_id, close_side=close_side, sz=sz, sl=sl_trigger, tp=tp_trigger,
                                      td_mode=td_mode))
        if self.fail_tpsl:
            raise InvalidOrder("okx 51000 tpsl rejected")
        algo_id = self._id()
        self.algos[algo_id] = AlgoOrder(algo_id=algo_id, inst_id=inst_id, side=close_side, pos_side=pos_side,
                                        sz=float(sz), sl_trigger=float(sl_trigger) if sl_trigger else None,
                                        tp_trigger=float(tp_trigger) if tp_trigger else None,
                                        algo_cl_id=algo_cl_id, ord_type="oco" if sl_trigger and tp_trigger else
                                        "conditional")
        return algo_id

    async def get_algo(self, algo_id=None, algo_cl_id=None):
        for a in self.algos.values():
            if a.algo_id == algo_id or (algo_cl_id and a.algo_cl_id == algo_cl_id):
                return a
        return None

    async def amend_tpsl(self, *, inst_id, algo_id, sl_trigger=None, tp_trigger=None, sz=None,
                         trigger_px_type="last"):
        self.amends.append(dict(inst_id=inst_id, algo_id=algo_id, sl=sl_trigger, tp=tp_trigger, sz=sz))
        if self.fail_amend:
            raise InvalidOrder("okx 51000 amend not supported")
        a = self.algos.get(algo_id)
        if a is None:
            raise InvalidOrder("okx 51603 algo does not exist")
        self.algos[algo_id] = replace(
            a, sl_trigger=float(sl_trigger) if sl_trigger else a.sl_trigger,
            tp_trigger=float(tp_trigger) if tp_trigger else a.tp_trigger, sz=float(sz) if sz else a.sz)

    async def cancel_algos(self, items):
        for _, algo_id in items:
            self.algos.pop(algo_id, None)

    async def cancel_all_algos(self):
        n = len(self.algos)
        self.algos.clear()
        return n

    async def cancel_all_orders(self):
        return 0

    async def close_position(self, inst_id, mgn_mode, pos_side):
        self.closed_calls.append((inst_id, mgn_mode))
        if inst_id not in self.positions:
            return False
        if self.stubborn_close.get(inst_id, 0) > 0:
            self.stubborn_close[inst_id] -= 1
            return True
        self._close(inst_id, self.prices[inst_id])
        return True

    async def get_closed_position(self, inst_id, side, since_ms):
        if not self.history_visible:
            return None
        return select_closed_position(list(reversed(self.history)), inst_id, side, since_ms)


def make_signal(side: str = "long", price: float = 60_000.0, atr: float = 100.0, ts: int = 0) -> Signal:
    sign = 1 if side == "long" else -1
    return Signal(side=side, price=price, ts=ts, levels=ExitLevels(
        stop_loss=price - sign * 1.5 * atr, take_profit=price + sign * 3 * atr, atr=atr,
        trail_activation=1.0 * atr, trail_distance=1.0 * atr), reason="test")


def wave_candles(n: int = 600, trend: float = 0.0004, amp: float = 0.03, period: int = 60, start: float = 100.0,
                 noise: float = 0.0, seed: int = 1, t0_ms: int = int(T0 * 1000) - 600 * 900_000) -> Candles:
    """Тренд + синусоида: EMA9/EMA21 регулярно пересекаются, EMA200 задаёт направление."""
    rng = np.random.default_rng(seed)
    rows = []
    prev = start
    for k in range(n):
        close = start * math.exp(trend * k) * (1 + amp * math.sin(2 * math.pi * k / period))
        close *= 1 + (rng.normal(0, noise) if noise else 0.0)
        o = prev
        h = max(o, close) * 1.001
        low = min(o, close) * 0.999
        rows.append([t0_ms + k * 900_000, o, h, low, close, 1.0])
        prev = close
    return Candles.from_rows(rows)


@pytest.fixture
def settings() -> Settings:
    return Settings(database_path=":memory:")


@pytest.fixture
def storage():
    s = Storage(":memory:")
    yield s
    s.close()


@pytest.fixture
def notifier() -> RecordingNotifier:
    return RecordingNotifier()


@pytest.fixture
def fake(clock) -> FakeOkx:
    f = FakeOkx()
    f.clock = clock
    return f


@pytest.fixture
def clock() -> Clock:
    return Clock()


def make_trade_record(storage: Storage, inst_id: str = BTC, side: str = "long", contracts: float = 1.0) -> int:
    from bot.models import Trade
    t = Trade(inst_id=inst_id, side=side, pos_side="net", contracts=contracts, entry_price=60_000,
              stop_loss=59_000, take_profit=62_000, initial_stop=59_000, atr=100, trail_activation=100,
              trail_distance=100, opened_at=int(T0 * 1000) - 3_600_000, ct_val=0.01)
    return storage.insert_trade(t)


@pytest.fixture
def trader_factory(settings, fake, storage, notifier, clock):
    from bot.strategies import create_strategy
    from bot.trader import Trader

    async def make(**overrides):
        t = Trader(overrides.get("settings", settings), fake, storage, create_strategy("ema_cross"), notifier,
                   clock=clock)
        t.poll_delay = 0
        await t.start()
        return t

    return make
