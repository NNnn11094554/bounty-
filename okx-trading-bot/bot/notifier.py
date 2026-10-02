"""Интерфейс уведомлений. Торговое ядро не зависит от Telegram напрямую."""

from __future__ import annotations

import logging
import re
import time

log = logging.getLogger("bot.notify")

_TAG_RE = re.compile(r"<[^>]+>")


class Notifier:
    """Базовый уведомитель: пишет в лог. Ошибки с одинаковым ключом не чаще раза в error_cooldown секунд."""

    error_cooldown = 900.0

    def __init__(self) -> None:
        self._last_error: dict[str, float] = {}

    async def send(self, text: str) -> None:
        log.info("[notify] %s", _TAG_RE.sub("", text))

    async def notify(self, text: str) -> None:
        try:
            await self.send(text)
        except Exception as exc:  # noqa: BLE001 — уведомления никогда не ломают торговлю
            log.warning("Не удалось отправить уведомление: %s", exc)

    async def error(self, key: str, text: str) -> None:
        now = time.monotonic()
        last = self._last_error.get(key)
        if last is not None and now - last < self.error_cooldown:
            log.debug("Уведомление об ошибке %s подавлено (cooldown)", key)
            return
        self._last_error[key] = now
        await self.notify(text)
