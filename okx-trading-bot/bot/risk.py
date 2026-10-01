"""Риск-менеджмент: размер позиции от расстояния до стопа и торговые лимиты."""

from __future__ import annotations

from dataclasses import dataclass

from .config import RiskConfig
from .models import InstrumentInfo


@dataclass(frozen=True)
class SizingResult:
    contracts: float
    qty: float  # в базовой монете
    notional: float  # USDT
    margin: float  # требуемая изолированная маржа, USDT
    risk_amount: float  # ожидаемый убыток при срабатывании стопа с учётом комиссий, USDT
    target_risk: float  # сколько хотели рисковать (risk_pct от equity)
    capped_by_margin: bool = False
    reason: str = ""

    @property
    def ok(self) -> bool:
        return self.contracts > 0


def calculate_position_size(
    *,
    equity: float,
    available: float,
    entry_price: float,
    stop_price: float,
    instrument: InstrumentInfo,
    risk_pct: float,
    leverage: float,
    fee_rate: float = 0.0005,
    max_margin_usage_pct: float = 90.0,
) -> SizingResult:
    """Размер позиции в контрактах так, чтобы убыток на стопе (с комиссиями входа и выхода)
    был не больше risk_pct% от equity, а маржа не превышала доступную.

    Количество округляется вниз до шага лота; если результат меньше минимального
    размера контракта — сделка невозможна (contracts=0, reason объясняет почему).
    """
    zero = dict(contracts=0.0, qty=0.0, notional=0.0, margin=0.0, risk_amount=0.0)
    target_risk = max(equity, 0.0) * risk_pct / 100.0
    if equity <= 0:
        return SizingResult(**zero, target_risk=0.0, reason="нулевой или отрицательный баланс")
    if entry_price <= 0 or stop_price <= 0:
        return SizingResult(**zero, target_risk=target_risk, reason="некорректная цена входа или стопа")
    stop_dist = abs(entry_price - stop_price)
    if stop_dist <= 0:
        return SizingResult(**zero, target_risk=target_risk, reason="стоп совпадает с ценой входа")
    if leverage <= 0:
        return SizingResult(**zero, target_risk=target_risk, reason="плечо должно быть > 0")

    ct_val = instrument.ct_val
    # убыток на 1 монету: движение до стопа + taker-комиссия на вход и на выход
    loss_per_coin = stop_dist + fee_rate * (entry_price + stop_price)
    contracts = target_risk / loss_per_coin / ct_val

    # ограничение по марже: notional/leverage + комиссия входа <= доступно * лимит
    margin_budget = max(available, 0.0) * max_margin_usage_pct / 100.0
    per_contract_margin = entry_price * ct_val * (1.0 / leverage + fee_rate)
    max_by_margin = margin_budget / per_contract_margin if per_contract_margin > 0 else 0.0
    capped = contracts > max_by_margin
    contracts = min(contracts, max_by_margin)
    if instrument.max_mkt_sz:
        contracts = min(contracts, instrument.max_mkt_sz)

    contracts = instrument.round_size_down(contracts)
    if contracts < instrument.min_size or contracts <= 0:
        why = ("недостаточно свободной маржи для минимального контракта" if capped
               else "расчётный объём меньше минимального размера контракта")
        return SizingResult(**zero, target_risk=target_risk, capped_by_margin=capped,
                            reason=f"{why} (минимум {instrument.min_sz} конт. = "
                                   f"{instrument.min_size * ct_val:g} монеты)")

    qty = contracts * ct_val
    notional = qty * entry_price
    return SizingResult(
        contracts=contracts,
        qty=qty,
        notional=notional,
        margin=notional / leverage,
        risk_amount=qty * loss_per_coin,
        target_risk=target_risk,
        capped_by_margin=capped,
    )


def stop_beyond_liquidation(entry_price: float, stop_price: float, leverage: float, safety: float = 0.8) -> bool:
    """True, если стоп дальше (или слишком близко к) примерной цене ликвидации изолированной позиции."""
    if leverage <= 0 or entry_price <= 0:
        return True
    return abs(entry_price - stop_price) / entry_price >= safety / leverage


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str = ""


class RiskManager:
    def __init__(self, cfg: RiskConfig):
        self.cfg = cfg

    def daily_pnl_pct(self, day_start_equity: float, equity: float) -> float:
        if day_start_equity <= 0:
            return 0.0
        return (equity - day_start_equity) / day_start_equity * 100.0

    def daily_limit_reached(self, day_start_equity: float, equity: float) -> bool:
        return self.daily_pnl_pct(day_start_equity, equity) <= -self.cfg.daily_loss_limit_pct

    def check_entry(
        self,
        *,
        inst_id: str,
        open_inst_ids: set[str],
        paused: bool,
        daily_limit_hit: bool,
    ) -> Decision:
        if paused:
            return Decision(False, "бот на паузе")
        if daily_limit_hit:
            return Decision(False, f"достигнут дневной лимит убытка {self.cfg.daily_loss_limit_pct:g}%")
        if inst_id in open_inst_ids:
            return Decision(False, "по инструменту уже есть позиция")
        if len(open_inst_ids) >= self.cfg.max_open_positions:
            return Decision(False, f"уже открыто максимум позиций ({self.cfg.max_open_positions})")
        return Decision(True)
