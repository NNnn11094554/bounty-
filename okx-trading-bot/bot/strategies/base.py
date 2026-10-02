"""Интерфейс стратегии.

Стратегия ничего не знает о бирже, балансе и размере позиции: она получает
закрытые свечи и возвращает сигнал с уровнями стопа/тейка/трейлинга.
Один и тот же код работает и в живой торговле, и в бэктесте.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, ClassVar

import numpy as np

from ..models import Candles, Side


@dataclass(frozen=True)
class ExitLevels:
    stop_loss: float
    take_profit: float | None
    atr: float = 0.0
    trail_activation: float | None = None  # на сколько (в цене) уйти в плюс, чтобы включить трейлинг
    trail_distance: float | None = None  # расстояние трейлинг-стопа от лучшей цены


@dataclass(frozen=True)
class Signal:
    side: Side
    price: float  # цена закрытия бара, на котором возник сигнал
    ts: int  # время открытия этого бара, мс
    levels: ExitLevels
    reason: str = ""

    @property
    def stop_distance(self) -> float:
        return abs(self.price - self.levels.stop_loss)

    @property
    def take_distance(self) -> float | None:
        if self.levels.take_profit is None:
            return None
        return abs(self.levels.take_profit - self.price)


Indicators = dict[str, np.ndarray]


class Strategy(ABC):
    """Базовый класс. Новая стратегия: унаследоваться, задать name и defaults,
    реализовать compute / signal_at / exit_levels и пометить класс @register."""

    name: ClassVar[str] = "base"
    defaults: ClassVar[dict[str, Any]] = {}

    def __init__(self, **params: Any):
        unknown = set(params) - set(self.defaults)
        if unknown:
            raise ValueError(f"{self.name}: неизвестные параметры {sorted(unknown)}")
        self.params: dict[str, Any] = {**self.defaults, **params}
        self.validate()

    def validate(self) -> None:
        """Проверка параметров; переопределите при необходимости."""

    @property
    @abstractmethod
    def min_candles(self) -> int:
        """Сколько закрытых свечей нужно для расчёта сигнала."""

    @abstractmethod
    def compute(self, candles: Candles) -> Indicators:
        """Рассчитать индикаторы по всей истории. Только причинные расчёты (без заглядывания вперёд)."""

    @abstractmethod
    def signal_at(self, candles: Candles, ind: Indicators, i: int) -> Signal | None:
        """Сигнал на закрытии бара i."""

    @abstractmethod
    def exit_levels(self, candles: Candles, ind: Indicators, i: int, side: Side, entry_price: float) -> ExitLevels:
        """Стоп, тейк и трейлинг для позиции, открытой по цене entry_price после бара i."""

    def generate_signal(self, candles: Candles) -> Signal | None:
        """Сигнал по последней закрытой свече (используется в живой торговле)."""
        if len(candles) < self.min_candles:
            return None
        ind = self.compute(candles)
        return self.signal_at(candles, ind, len(candles) - 1)

    def protective_levels(self, candles: Candles, side: Side, entry_price: float) -> ExitLevels | None:
        """Уровни для позиции, найденной на бирже без данных о ней (например, после потери БД)."""
        if len(candles) < self.min_candles:
            return None
        ind = self.compute(candles)
        return self.exit_levels(candles, ind, len(candles) - 1, side, entry_price)
