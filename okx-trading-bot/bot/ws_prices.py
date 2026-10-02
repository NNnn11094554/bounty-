"""Цены в реальном времени через публичный WebSocket OKX (канал tickers).

Если WebSocket молчит дольше stale_after секунд, цена берётся через REST.
Подключение переподнимается автоматически с экспоненциальной задержкой.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

import aiohttp

from .exchange import backoff_delay

log = logging.getLogger("bot.ws")

PING_INTERVAL = 20  # OKX рвёт соединение после 30с тишины


@dataclass
class _Quote:
    last: float
    high: float  # экстремумы с момента последнего чтения — для трейлинга
    low: float
    ts: float  # time.monotonic() последнего обновления


class PriceFeed:
    def __init__(
        self,
        url: str,
        inst_ids: list[str],
        rest_fallback: Callable[[str], Awaitable[float]],
        stale_after: float = 15.0,
    ):
        self.url = url
        self.inst_ids = list(inst_ids)
        self.rest_fallback = rest_fallback
        self.stale_after = stale_after
        self._quotes: dict[str, _Quote] = {}
        self._stop = asyncio.Event()
        self.connected = False
        self.reconnects = 0

    # ---------- данные ----------

    def update(self, inst_id: str, price: float) -> None:
        now = time.monotonic()
        q = self._quotes.get(inst_id)
        if q is None:
            self._quotes[inst_id] = _Quote(price, price, price, now)
        else:
            q.last, q.ts = price, now
            q.high = max(q.high, price)
            q.low = min(q.low, price)

    def is_fresh(self, inst_id: str) -> bool:
        q = self._quotes.get(inst_id)
        return q is not None and time.monotonic() - q.ts <= self.stale_after

    async def get_price(self, inst_id: str) -> float:
        """Последняя цена: из WebSocket, а если поток устарел — через REST."""
        if self.is_fresh(inst_id):
            return self._quotes[inst_id].last
        price = await self.rest_fallback(inst_id)
        self.update(inst_id, price)
        return price

    def reset_range(self, inst_id: str) -> None:
        """Забыть накопленные экстремумы (например, при открытии новой позиции)."""
        q = self._quotes.get(inst_id)
        if q is not None:
            q.high = q.low = q.last

    async def take_range(self, inst_id: str) -> tuple[float, float, float]:
        """(last, high, low) с момента предыдущего вызова; затем экстремумы сбрасываются."""
        last = await self.get_price(inst_id)
        q = self._quotes[inst_id]
        high, low = max(q.high, last), min(q.low, last)
        q.high = q.low = last
        return last, high, low

    # ---------- WebSocket ----------

    def handle_message(self, raw: str) -> None:
        if raw == "pong":
            return
        msg = json.loads(raw)
        if msg.get("event") == "error":
            log.error("WS ошибка OKX: %s %s", msg.get("code"), msg.get("msg"))
            return
        if msg.get("event"):
            return
        if msg.get("arg", {}).get("channel") != "tickers":
            return
        for d in msg.get("data", []):
            try:
                self.update(d["instId"], float(d["last"]))
            except (KeyError, TypeError, ValueError):
                continue

    async def run(self) -> None:
        attempt = 0
        while not self._stop.is_set():
            try:
                # таймауты только на установку соединения: само соединение живёт сколько угодно
                timeout = aiohttp.ClientTimeout(total=None, connect=20, sock_connect=15)
                async with aiohttp.ClientSession(trust_env=True, timeout=timeout) as session:
                    async with session.ws_connect(self.url, heartbeat=None, autoping=True,
                                                  timeout=aiohttp.ClientWSTimeout(ws_close=10)) as ws:
                        await ws.send_str(json.dumps({
                            "op": "subscribe",
                            "args": [{"channel": "tickers", "instId": i} for i in self.inst_ids],
                        }))
                        self.connected = True
                        attempt = 0
                        log.info("WebSocket подключён: %s", self.url)
                        await self._read_loop(ws)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — любые сбои сети: переподключаемся
                log.warning("WebSocket: %s: %s", type(exc).__name__, exc)
            finally:
                self.connected = False
            if self._stop.is_set():
                break
            attempt += 1
            self.reconnects += 1
            delay = backoff_delay(attempt, base=1.0, cap=60.0)
            log.info("WebSocket переподключение через %.1fс (цены пока через REST)", delay)
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=delay)
            except TimeoutError:
                pass

    async def _read_loop(self, ws: aiohttp.ClientWebSocketResponse) -> None:
        waiting_pong = False
        while not self._stop.is_set():
            try:
                msg = await ws.receive(timeout=PING_INTERVAL)
            except TimeoutError:
                if waiting_pong:
                    raise ConnectionError("нет ответа на ping") from None
                await ws.send_str("ping")
                waiting_pong = True
                continue
            waiting_pong = False
            if msg.type == aiohttp.WSMsgType.TEXT:
                self.handle_message(msg.data)
            elif msg.type in (aiohttp.WSMsgType.CLOSED, aiohttp.WSMsgType.CLOSING, aiohttp.WSMsgType.ERROR):
                raise ConnectionError(f"соединение закрыто ({msg.type.name})")

    async def stop(self) -> None:
        self._stop.set()
