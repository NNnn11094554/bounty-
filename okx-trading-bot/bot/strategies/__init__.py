"""Реестр стратегий.

Чтобы добавить стратегию, положите файл в эту папку, унаследуйтесь от Strategy
и пометьте класс декоратором @register. Затем укажите её имя в config.yaml:

    strategy:
      name: my_strategy
      params: {...}
"""

from __future__ import annotations

import importlib
import pkgutil
from typing import Any

from .base import ExitLevels, Signal, Strategy

REGISTRY: dict[str, type[Strategy]] = {}


def register(cls: type[Strategy]) -> type[Strategy]:
    if cls.name in REGISTRY and REGISTRY[cls.name] is not cls:
        raise ValueError(f"Стратегия {cls.name!r} уже зарегистрирована")
    REGISTRY[cls.name] = cls
    return cls


def _discover() -> None:
    for mod in pkgutil.iter_modules(__path__):
        if mod.name != "base":
            importlib.import_module(f"{__name__}.{mod.name}")


def create_strategy(name: str, params: dict[str, Any] | None = None) -> Strategy:
    _discover()
    try:
        cls = REGISTRY[name]
    except KeyError:
        raise ValueError(f"Неизвестная стратегия {name!r}. Доступны: {sorted(REGISTRY)}") from None
    return cls(**(params or {}))


__all__ = ["ExitLevels", "Signal", "Strategy", "register", "create_strategy", "REGISTRY"]
