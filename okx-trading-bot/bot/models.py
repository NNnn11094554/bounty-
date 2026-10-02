"""Общие структуры данных: свечи, инструмент, позиции, ордера, сделки."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from decimal import ROUND_DOWN, ROUND_HALF_UP, ROUND_UP, Decimal
from typing import Literal

import numpy as np

Side = Literal["long", "short"]


@dataclass(frozen=True)
class Candles:
    """Свечи по возрастанию времени. ts — время открытия бара в мс (UTC)."""

    ts: np.ndarray
    open: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close: np.ndarray
    volume: np.ndarray

    def __post_init__(self) -> None:
        n = len(self.ts)
        for name in ("open", "high", "low", "close", "volume"):
            if len(getattr(self, name)) != n:
                raise ValueError(f"candles.{name}: длина не совпадает с ts")

    def __len__(self) -> int:
        return len(self.ts)

    @classmethod
    def from_rows(cls, rows: list[list[float]] | list[tuple]) -> Candles:
        """rows: [ts, open, high, low, close, volume] в любом порядке по времени."""
        if not rows:
            empty = np.array([], dtype=float)
            return cls(np.array([], dtype=np.int64), empty, empty, empty, empty, empty)
        dedup: dict[int, list] = {}
        for r in rows:
            dedup[int(r[0])] = list(r)
        rows = [dedup[k] for k in sorted(dedup)]
        arr = np.array([[float(x) for x in r[:6]] for r in rows], dtype=float)
        return cls(
            ts=arr[:, 0].astype(np.int64),
            open=arr[:, 1],
            high=arr[:, 2],
            low=arr[:, 3],
            close=arr[:, 4],
            volume=arr[:, 5],
        )

    def slice(self, start: int | None = None, stop: int | None = None) -> Candles:
        s = slice(start, stop)
        return Candles(self.ts[s], self.open[s], self.high[s], self.low[s], self.close[s], self.volume[s])


def _decimals(step: Decimal) -> int:
    return max(0, -step.normalize().as_tuple().exponent)


@dataclass(frozen=True)
class InstrumentInfo:
    """Параметры контракта из /api/v5/public/instruments."""

    inst_id: str
    ct_val: float  # базовой монеты в одном контракте (BTC-USDT-SWAP: 0.01 BTC)
    lot_sz: str  # шаг количества контрактов
    min_sz: str  # минимальное количество контрактов
    tick_sz: str  # шаг цены
    max_lever: float = 100.0
    max_mkt_sz: float | None = None  # максимум контрактов в одном рыночном ордере

    @property
    def lot(self) -> Decimal:
        return Decimal(self.lot_sz)

    @property
    def tick(self) -> Decimal:
        return Decimal(self.tick_sz)

    @property
    def min_size(self) -> float:
        return float(self.min_sz)

    @property
    def tick_size(self) -> float:
        return float(self.tick_sz)

    def round_size_down(self, contracts: float) -> float:
        if not math.isfinite(contracts) or contracts <= 0:
            return 0.0
        lots = (Decimal(repr(contracts)) / self.lot).quantize(Decimal(1), rounding=ROUND_DOWN)
        return float(lots * self.lot)

    def round_price(self, price: float, mode: Literal["nearest", "down", "up"] = "nearest") -> float:
        rounding = {"nearest": ROUND_HALF_UP, "down": ROUND_DOWN, "up": ROUND_UP}[mode]
        ticks = (Decimal(repr(price)) / self.tick).quantize(Decimal(1), rounding=rounding)
        return float(ticks * self.tick)

    def fmt_price(self, price: float) -> str:
        return f"{self.round_price(price):.{_decimals(self.tick)}f}"

    def fmt_size(self, contracts: float) -> str:
        return f"{self.round_size_down(contracts):.{_decimals(self.lot)}f}"


@dataclass(frozen=True)
class Balance:
    equity: float  # equity USDT (с учётом нереализованного PnL)
    available: float  # свободно для новой маржи


@dataclass(frozen=True)
class AccountConfig:
    pos_mode: str  # net_mode | long_short_mode
    acct_lv: str  # 1 — простой (свопы недоступны), 2+ — с маржой


@dataclass(frozen=True)
class Position:
    inst_id: str
    side: Side
    pos_side: str  # net | long | short
    contracts: float
    avg_px: float
    upl: float = 0.0
    mark_px: float = 0.0
    liq_px: float | None = None
    lever: float | None = None
    mgn_mode: str = "isolated"
    c_time: int = 0


@dataclass(frozen=True)
class AlgoOrder:
    """Висящий TP/SL algo-ордер (ordType conditional / oco)."""

    algo_id: str
    inst_id: str
    side: str  # buy | sell — сторона закрывающего ордера
    pos_side: str
    sz: float
    sl_trigger: float | None
    tp_trigger: float | None
    algo_cl_id: str = ""
    ord_type: str = "oco"
    close_fraction: bool = False

    def protects(self, side: Side) -> bool:
        """Закрывает ли этот ордер позицию указанного направления."""
        close_side = "sell" if side == "long" else "buy"
        return self.side == close_side and self.pos_side in ("net", side)


@dataclass(frozen=True)
class OrderInfo:
    ord_id: str
    state: str  # live | partially_filled | filled | canceled
    avg_px: float
    filled_sz: float
    fee: float = 0.0


@dataclass(frozen=True)
class ClosedPosition:
    inst_id: str
    side: Side
    open_avg_px: float
    close_avg_px: float
    realized_pnl: float  # с учётом комиссий и фандинга
    fee: float
    funding_fee: float
    close_type: str  # 1 частичное, 2 полное, 3 ликвидация, 4 частичная ликвидация, 5 ADL
    u_time: int


@dataclass
class Trade:
    """Сделка, которую сопровождает бот (строка таблицы trades)."""

    inst_id: str
    side: Side
    pos_side: str
    contracts: float
    entry_price: float
    stop_loss: float
    take_profit: float | None
    initial_stop: float
    atr: float
    trail_activation: float | None
    trail_distance: float | None
    opened_at: int  # мс
    ct_val: float
    mode: str = "DEMO"
    strategy: str = ""
    trailing_active: bool = False
    best_price: float = 0.0
    ord_id: str = ""
    algo_id: str = ""
    algo_cl_id: str = ""
    status: str = "open"
    id: int | None = None
    closed_at: int | None = None
    exit_price: float | None = None
    pnl: float | None = None
    fee: float | None = None
    close_reason: str = ""
    note: str = ""
    mgn_mode: str = "isolated"
    # только в памяти: когда впервые заметили, что позиции на бирже нет (мс)
    missing_since: int | None = field(default=None, compare=False)

    @property
    def qty(self) -> float:
        """Количество в базовой монете."""
        return self.contracts * self.ct_val

    def unrealized(self, price: float) -> float:
        sign = 1 if self.side == "long" else -1
        return sign * (price - self.entry_price) * self.qty
