"""Клиент OKX API v5 поверх ccxt.

Используются «сырые» эндпоинты OKX (implicit API ccxt): так видно, какие именно
запросы уходят на биржу, а ccxt берёт на себя подпись, rate limit и разбор ошибок.
DEMO-режим — ccxt sandbox: добавляет заголовок x-simulated-trading: 1.
"""

from __future__ import annotations

import asyncio
import logging
import random
import uuid
from collections.abc import Awaitable, Callable, Iterable
from typing import Any, TypeVar

import ccxt.async_support as ccxt_async
from ccxt.base.errors import (
    BadRequest,
    ExchangeError,
    InvalidNonce,
    InvalidOrder,
    NetworkError,
    OrderNotFound,
    RateLimitExceeded,
)

from .models import (
    AccountConfig,
    AlgoOrder,
    Balance,
    Candles,
    ClosedPosition,
    InstrumentInfo,
    OrderInfo,
    Position,
)

log = logging.getLogger("bot.exchange")
T = TypeVar("T")

CLIENT_ID_PREFIX = "okxb"  # все clOrdId/algoClOrdId бота начинаются с него
TPSL_TYPES = "conditional,oco"
ALL_ALGO_TYPES = (TPSL_TYPES, "trigger", "move_order_stop")


def new_client_id(kind: str = "") -> str:
    """OKX: до 32 латинских букв/цифр."""
    return (CLIENT_ID_PREFIX + kind + uuid.uuid4().hex)[:32]


def _f(value: Any, default: float = 0.0) -> float:
    try:
        return float(value) if value not in (None, "") else default
    except (TypeError, ValueError):
        return default


def _first(d: dict, *keys: str) -> float:
    for k in keys:
        if d.get(k) not in (None, ""):
            return _f(d[k])
    return 0.0


def _chunks(items: list[T], size: int) -> Iterable[list[T]]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def backoff_delay(attempt: int, base: float = 0.5, cap: float = 30.0) -> float:
    """Экспоненциальная задержка с джиттером: 0.5, 1, 2, 4 ... (attempt с 1)."""
    return min(cap, base * 2 ** (attempt - 1)) * (0.8 + 0.4 * random.random())


async def with_retries(
    fn: Callable[[], Awaitable[T]],
    *,
    attempts: int = 5,
    base_delay: float = 0.5,
    max_delay: float = 30.0,
    what: str = "request",
    retry_on: tuple[type[BaseException], ...] = (NetworkError,),
    on_retry: Callable[[BaseException], Awaitable[None]] | None = None,
    sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
) -> T:
    """Повтор при сетевых ошибках, таймаутах, rate limit и техработах биржи.
    Ошибки бизнес-логики (нет маржи, неверный ордер, неверные ключи) не повторяются."""
    for attempt in range(1, attempts + 1):
        try:
            return await fn()
        except retry_on as exc:
            if attempt >= attempts:
                raise
            delay = backoff_delay(attempt, base_delay, max_delay)
            if isinstance(exc, RateLimitExceeded):
                delay = max(delay, 1.0)
            log.warning("%s: %s: %s — повтор %d/%d через %.1fс", what, type(exc).__name__,
                        str(exc)[:200], attempt, attempts - 1, delay)
            if on_retry is not None:
                await on_retry(exc)
            await sleep(delay)
    raise AssertionError("unreachable")


class OkxClient:
    def __init__(
        self,
        *,
        api_key: str = "",
        secret: str = "",
        passphrase: str = "",
        demo: bool = True,
        hostname: str = "www.okx.com",
        timeout_sec: float = 15,
        retry_attempts: int = 5,
    ):
        self.demo = demo
        self.retry_attempts = retry_attempts
        self.ex = ccxt_async.okx({
            "apiKey": api_key,
            "secret": secret,
            "password": passphrase,
            "enableRateLimit": True,  # встроенный лимитер ccxt с весами эндпоинтов OKX
            "timeout": int(timeout_sec * 1000),
            "hostname": hostname,
            "aiohttp_trust_env": True,
            "options": {"defaultType": "swap"},
        })
        if demo:
            self.ex.set_sandbox_mode(True)  # x-simulated-trading: 1
        assert not demo or self.ex.headers.get("x-simulated-trading") == "1"

    async def close(self) -> None:
        await self.ex.close()

    # ---------- низкий уровень ----------

    async def _on_retry(self, exc: BaseException) -> None:
        if isinstance(exc, InvalidNonce):  # 50102: расхождение часов — синхронизируемся
            await self.sync_time()

    async def _request(self, method: str, params: Any = None, *, retry: bool = True) -> list:
        fn = getattr(self.ex, method)

        async def call() -> list:
            resp = await fn({} if params is None else params)
            return resp.get("data", []) if isinstance(resp, dict) else resp

        if not retry:
            return await call()
        return await with_retries(call, attempts=self.retry_attempts, what=method, on_retry=self._on_retry)

    async def _place_idempotent(self, method: str, params: dict, id_key: str,
                                lookup: Callable[[], Awaitable[str | None]]) -> str:
        """Размещение ордера без дублей: при сетевой ошибке запрос мог дойти до биржи,
        поэтому перед повтором ищем ордер по client id."""
        for attempt in range(1, self.retry_attempts + 1):
            try:
                data = await self._request(method, params, retry=False)
                return str(data[0][id_key])
            except NetworkError as exc:
                if attempt >= self.retry_attempts:
                    raise
                delay = backoff_delay(attempt)
                log.warning("%s: %s — проверяю, дошёл ли ордер, повтор через %.1fс",
                            method, type(exc).__name__, delay)
                await self._on_retry(exc)
                await asyncio.sleep(delay)
                try:
                    found = await lookup()
                except NetworkError:
                    found = None
                if found:
                    log.info("%s: ордер найден на бирже после сетевой ошибки: %s", method, found)
                    return found
        raise AssertionError("unreachable")

    async def sync_time(self) -> None:
        try:
            await self.ex.load_time_difference()
        except Exception as exc:  # noqa: BLE001
            log.warning("Не удалось синхронизировать время с OKX: %s", exc)

    # ---------- публичные данные ----------

    async def server_time_ms(self) -> int:
        data = await self._request("public_get_public_time")
        return int(data[0]["ts"])

    async def load_instruments(self, inst_ids: Iterable[str]) -> dict[str, InstrumentInfo]:
        data = await self._request("public_get_public_instruments", {"instType": "SWAP"})
        by_id = {d["instId"]: d for d in data}
        out: dict[str, InstrumentInfo] = {}
        for inst_id in inst_ids:
            d = by_id.get(inst_id)
            if d is None:
                raise ValueError(f"Инструмент {inst_id} не найден на OKX")
            if d.get("state") not in (None, "", "live"):
                raise ValueError(f"Инструмент {inst_id} сейчас не торгуется (state={d.get('state')})")
            out[inst_id] = InstrumentInfo(
                inst_id=inst_id,
                ct_val=_f(d["ctVal"]),
                lot_sz=str(d["lotSz"]),
                min_sz=str(d["minSz"]),
                tick_sz=str(d["tickSz"]),
                max_lever=_f(d.get("lever"), 100.0),
                max_mkt_sz=_f(d.get("maxMktSz")) or None,
            )
        return out

    async def fetch_candles(self, inst_id: str, bar: str, limit: int = 600, closed_only: bool = True) -> Candles:
        """Последние свечи (до ~1440 шт.), по возрастанию времени. Незакрытая свеча отбрасывается."""
        rows: list[list] = []
        after: int | None = None
        while len(rows) < limit:
            batch = min(300, limit - len(rows))
            params = {"instId": inst_id, "bar": bar, "limit": str(batch)}
            if after is not None:
                params["after"] = str(after)
            data = await self._request("public_get_market_candles", params)
            if not data:
                break
            rows.extend(data)
            after = min(int(r[0]) for r in data)
            if len(data) < batch:
                break
        if closed_only:
            rows = [r for r in rows if len(r) < 9 or str(r[8]) == "1"]
        return Candles.from_rows([r[:6] for r in rows])

    async def fetch_history_candles(
        self, inst_id: str, bar: str, start_ms: int, end_ms: int,
        progress: Callable[[int], None] | None = None,
    ) -> Candles:
        """История для бэктеста через /market/history-candles (по 100 свечей за запрос)."""
        rows: dict[int, list] = {}
        after = end_ms
        while True:
            data = await self._request("public_get_market_history_candles",
                                       {"instId": inst_id, "bar": bar, "after": str(after), "limit": "100"})
            if not data:
                break
            for r in data:
                ts = int(r[0])
                if start_ms <= ts < end_ms and (len(r) < 9 or str(r[8]) == "1"):
                    rows[ts] = r[:6]
            oldest = min(int(r[0]) for r in data)
            if progress:
                progress(len(rows))
            if oldest <= start_ms or oldest >= after:
                break
            after = oldest
        return Candles.from_rows(list(rows.values()))

    async def fetch_ticker_price(self, inst_id: str) -> float:
        data = await self._request("public_get_market_ticker", {"instId": inst_id})
        return _f(data[0]["last"])

    # ---------- аккаунт ----------

    async def get_account_config(self) -> AccountConfig:
        d = (await self._request("private_get_account_config"))[0]
        return AccountConfig(pos_mode=d.get("posMode") or "net_mode", acct_lv=str(d.get("acctLv") or ""))

    async def get_balance(self, ccy: str = "USDT") -> Balance:
        data = await self._request("private_get_account_balance", {"ccy": ccy})
        details = data[0].get("details", []) if data else []
        d = next((x for x in details if x.get("ccy") == ccy), None)
        if d is None:
            return Balance(equity=0.0, available=0.0)
        return Balance(equity=_first(d, "eq", "cashBal"),
                       available=_first(d, "availBal", "availEq", "cashBal"))

    async def get_positions(self) -> list[Position]:
        data = await self._request("private_get_account_positions", {"instType": "SWAP"})
        out: list[Position] = []
        for d in data:
            pos = _f(d.get("pos"))
            if pos == 0:
                continue
            pos_side = d.get("posSide") or "net"
            side = ("long" if pos > 0 else "short") if pos_side == "net" else pos_side
            out.append(Position(
                inst_id=d["instId"], side=side, pos_side=pos_side, contracts=abs(pos),
                avg_px=_f(d.get("avgPx")), upl=_f(d.get("upl")), mark_px=_f(d.get("markPx")),
                liq_px=_f(d.get("liqPx")) or None, lever=_f(d.get("lever")) or None,
                mgn_mode=d.get("mgnMode") or "isolated", c_time=int(_f(d.get("cTime"))),
            ))
        return out

    async def set_leverage(self, inst_id: str, lever: int, mgn_mode: str, pos_mode: str) -> None:
        if mgn_mode == "isolated" and pos_mode == "long_short_mode":
            for ps in ("long", "short"):
                await self._request("private_post_account_set_leverage",
                                    {"instId": inst_id, "lever": str(lever), "mgnMode": mgn_mode, "posSide": ps})
        else:
            await self._request("private_post_account_set_leverage",
                                {"instId": inst_id, "lever": str(lever), "mgnMode": mgn_mode})

    # ---------- ордера ----------

    async def place_market_order(
        self,
        *,
        inst_id: str,
        side: str,
        sz: str,
        td_mode: str,
        pos_side: str,
        cl_ord_id: str,
        sl_trigger: str | None = None,
        tp_trigger: str | None = None,
        attach_algo_cl_id: str | None = None,
        trigger_px_type: str = "last",
        reduce_only: bool = False,
    ) -> str:
        """Рыночный ордер. SL/TP прикрепляются к ордеру (attachAlgoOrds) и появляются на бирже
        одновременно с позицией."""
        params: dict[str, Any] = {"instId": inst_id, "tdMode": td_mode, "side": side,
                                  "ordType": "market", "sz": sz, "clOrdId": cl_ord_id}
        if pos_side != "net":
            params["posSide"] = pos_side
        elif reduce_only:
            params["reduceOnly"] = True
        if sl_trigger or tp_trigger:
            attach: dict[str, Any] = {}
            if attach_algo_cl_id:
                attach["attachAlgoClOrdId"] = attach_algo_cl_id
            if tp_trigger:
                attach.update(tpTriggerPx=tp_trigger, tpOrdPx="-1", tpTriggerPxType=trigger_px_type)
            if sl_trigger:
                attach.update(slTriggerPx=sl_trigger, slOrdPx="-1", slTriggerPxType=trigger_px_type)
            params["attachAlgoOrds"] = [attach]

        async def lookup() -> str | None:
            info = await self.get_order(inst_id, cl_ord_id=cl_ord_id)
            return info.ord_id if info else None

        return await self._place_idempotent("private_post_trade_order", params, "ordId", lookup)

    async def get_order(self, inst_id: str, ord_id: str | None = None,
                        cl_ord_id: str | None = None) -> OrderInfo | None:
        params = {"instId": inst_id}
        if ord_id:
            params["ordId"] = ord_id
        else:
            params["clOrdId"] = cl_ord_id or ""
        try:
            data = await self._request("private_get_trade_order", params)
        except (OrderNotFound, BadRequest):
            return None
        if not data:
            return None
        d = data[0]
        return OrderInfo(ord_id=str(d["ordId"]), state=d.get("state", ""), avg_px=_f(d.get("avgPx")),
                         filled_sz=_f(d.get("accFillSz")), fee=_f(d.get("fee")))

    async def cancel_order(self, inst_id: str, ord_id: str) -> None:
        try:
            await self._request("private_post_trade_cancel_order", {"instId": inst_id, "ordId": ord_id})
        except (OrderNotFound, InvalidOrder) as exc:
            log.info("cancel_order %s %s: %s", inst_id, ord_id, exc)

    # ---------- TP/SL (algo) ----------

    @staticmethod
    def _parse_algo(d: dict) -> AlgoOrder:
        return AlgoOrder(
            algo_id=str(d["algoId"]),
            inst_id=d["instId"],
            side=d.get("side", ""),
            pos_side=d.get("posSide") or "net",
            sz=_f(d.get("sz")),
            sl_trigger=_f(d.get("slTriggerPx")) or None,
            tp_trigger=_f(d.get("tpTriggerPx")) or None,
            algo_cl_id=d.get("algoClOrdId") or "",
            ord_type=d.get("ordType", ""),
            close_fraction=bool(_f(d.get("closeFraction"))),
        )

    async def place_tpsl(
        self,
        *,
        inst_id: str,
        close_side: str,
        pos_side: str,
        td_mode: str,
        sz: str,
        sl_trigger: str | None,
        tp_trigger: str | None,
        algo_cl_id: str,
        trigger_px_type: str = "last",
    ) -> str:
        """Отдельный TP/SL (oco, либо conditional если задан только один уровень), исполнение по рынку."""
        if not sl_trigger and not tp_trigger:
            raise ValueError("нужен хотя бы SL или TP")
        params: dict[str, Any] = {
            "instId": inst_id, "tdMode": td_mode, "side": close_side,
            "ordType": "oco" if sl_trigger and tp_trigger else "conditional",
            "sz": sz, "algoClOrdId": algo_cl_id,
        }
        if pos_side != "net":
            params["posSide"] = pos_side
        else:
            params["reduceOnly"] = True
        if tp_trigger:
            params.update(tpTriggerPx=tp_trigger, tpOrdPx="-1", tpTriggerPxType=trigger_px_type)
        if sl_trigger:
            params.update(slTriggerPx=sl_trigger, slOrdPx="-1", slTriggerPxType=trigger_px_type)

        async def lookup() -> str | None:
            algo = await self.get_algo(algo_cl_id=algo_cl_id)
            return algo.algo_id if algo else None

        return await self._place_idempotent("private_post_trade_order_algo", params, "algoId", lookup)

    async def get_algo(self, algo_id: str | None = None, algo_cl_id: str | None = None) -> AlgoOrder | None:
        params = {"algoId": algo_id} if algo_id else {"algoClOrdId": algo_cl_id or ""}
        try:
            data = await self._request("private_get_trade_order_algo", params)
        except (OrderNotFound, BadRequest, InvalidOrder):
            return None
        return self._parse_algo(data[0]) if data else None

    async def get_pending_tpsl(self, inst_id: str | None = None) -> list[AlgoOrder]:
        params = {"ordType": TPSL_TYPES, "instType": "SWAP"}
        if inst_id:
            params["instId"] = inst_id
        data = await self._request("private_get_trade_orders_algo_pending", params)
        return [self._parse_algo(d) for d in data]

    async def amend_tpsl(
        self,
        *,
        inst_id: str,
        algo_id: str,
        sl_trigger: str | None = None,
        tp_trigger: str | None = None,
        sz: str | None = None,
        trigger_px_type: str = "last",
    ) -> None:
        params: dict[str, Any] = {"instId": inst_id, "algoId": algo_id}
        if sl_trigger:
            params.update(newSlTriggerPx=sl_trigger, newSlOrdPx="-1", newSlTriggerPxType=trigger_px_type)
        if tp_trigger:
            params.update(newTpTriggerPx=tp_trigger, newTpOrdPx="-1", newTpTriggerPxType=trigger_px_type)
        if sz:
            params["newSz"] = sz
        await self._request("private_post_trade_amend_algos", params)

    async def cancel_algos(self, items: list[tuple[str, str]]) -> None:
        for chunk in _chunks(items, 10):
            try:
                await self._request("private_post_trade_cancel_algos",
                                    [{"instId": inst_id, "algoId": algo_id} for inst_id, algo_id in chunk])
            except (OrderNotFound, InvalidOrder) as exc:  # уже исполнен/отменён
                log.info("cancel_algos: %s", exc)

    async def cancel_all_algos(self) -> int:
        items: list[tuple[str, str]] = []
        for ord_type in ALL_ALGO_TYPES:
            data = await self._request("private_get_trade_orders_algo_pending",
                                       {"ordType": ord_type, "instType": "SWAP"})
            items.extend((d["instId"], str(d["algoId"])) for d in data)
        if items:
            await self.cancel_algos(items)
        return len(items)

    async def cancel_all_orders(self) -> int:
        data = await self._request("private_get_trade_orders_pending", {"instType": "SWAP"})
        items = [{"instId": d["instId"], "ordId": str(d["ordId"])} for d in data]
        for chunk in _chunks(items, 20):
            try:
                await self._request("private_post_trade_cancel_batch_orders", chunk)
            except (OrderNotFound, InvalidOrder) as exc:
                log.info("cancel_all_orders: %s", exc)
        return len(items)

    # ---------- позиции ----------

    async def close_position(self, inst_id: str, mgn_mode: str, pos_side: str) -> bool:
        """Закрыть позицию целиком по рынку (с автоотменой висящих ордеров на закрытие).
        False — позиции уже не было (например, только что сработал TP/SL)."""
        try:
            await self._request("private_post_trade_close_position",
                                {"instId": inst_id, "mgnMode": mgn_mode, "posSide": pos_side, "autoCxl": True})
            return True
        except ExchangeError as exc:
            if "51023" in str(exc):  # позиции уже нет
                log.info("close_position %s: позиции уже нет", inst_id)
                return False
            raise

    async def get_closed_position(self, inst_id: str, side: str, since_ms: int) -> ClosedPosition | None:
        """Итог закрытой позиции из /account/positions-history (самая ранняя после since_ms)."""
        data = await self._request("private_get_account_positions_history",
                                   {"instType": "SWAP", "instId": inst_id, "limit": "50"})
        candidates = []
        for d in data:
            direction = d.get("direction") or d.get("posSide")
            if direction != side:
                continue
            u_time = int(_f(d.get("uTime")))
            if u_time < since_ms - 60_000:
                continue
            candidates.append(d)
        if not candidates:
            return None
        full = [d for d in candidates if str(d.get("type")) in ("2", "3", "4", "5")] or candidates
        d = min(full, key=lambda x: int(_f(x.get("uTime"))))
        return ClosedPosition(
            inst_id=inst_id, side=side, open_avg_px=_f(d.get("openAvgPx")),
            close_avg_px=_f(d.get("closeAvgPx")),
            realized_pnl=_first(d, "realizedPnl", "pnl"), fee=_f(d.get("fee")),
            funding_fee=_f(d.get("fundingFee")), close_type=str(d.get("type", "")),
            u_time=int(_f(d.get("uTime"))),
        )
