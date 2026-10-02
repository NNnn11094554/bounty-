"""Локальный мок OKX API v5 (REST + публичный WebSocket) для сквозной проверки DEMO-режима без сети.

Проверяет то же, что проверила бы биржа: HMAC-подпись каждого приватного запроса,
passphrase, заголовок демо-торговли x-simulated-trading: 1, кратность лоту, маржу.
Сам исполняет TP/SL algo-ордера при достижении цены — как OKX.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass, field

from aiohttp import WSMsgType, web

from bot.backtest import DEFAULT_INSTRUMENTS


@dataclass
class MockPosition:
    side: str
    sz: float
    avg_px: float
    c_time: int
    lever: int


@dataclass
class MockAlgo:
    algo_id: str
    inst_id: str
    side: str
    sz: float
    sl: float | None
    tp: float | None
    algo_cl_id: str
    ord_type: str


@dataclass
class MockOkx:
    api_key: str
    secret: str
    passphrase: str
    cash: float = 1000.0
    fee_rate: float = 0.0005
    tf_ms: int = 900_000
    closes: dict[str, list[float]] = field(default_factory=dict)  # закрытые свечи (последняя — последний закрытый бар)
    prices: dict[str, float] = field(default_factory=dict)
    fail_next: dict[str, tuple] = field(default_factory=dict)  # path -> (http, code, msg[, sCode])

    def __post_init__(self):
        self.positions: dict[str, MockPosition] = {}
        self.algos: dict[str, MockAlgo] = {}
        self.orders: dict[str, dict] = {}
        self.history: list[dict] = []
        self.leverage: dict[str, int] = {}
        self.log: list[tuple[str, str, object]] = []  # (method, path, payload)
        self.auth_failures: list[str] = []
        self.demo_header_missing: list[str] = []
        self.ws_subscriptions: set[str] = set()
        self._seq = 0
        self._engine: asyncio.Task | None = None

    # ---------- сервер ----------

    def app(self) -> web.Application:
        app = web.Application()
        app.router.add_route("*", "/api/v5/{tail:.*}", self.handle)
        app.router.add_get("/ws/v5/public", self.ws_handler)
        app.on_startup.append(self._start_engine)
        app.on_cleanup.append(self._stop_engine)
        return app

    async def _start_engine(self, _app):
        self._engine = asyncio.create_task(self._engine_loop())

    async def _stop_engine(self, _app):
        if self._engine:
            self._engine.cancel()

    async def _engine_loop(self):
        while True:
            await asyncio.sleep(0.05)
            self.match_algos()

    def calls(self, method: str, path: str) -> list:
        return [p for m, pth, p in self.log if m == method and pth == path]

    def _id(self) -> str:
        self._seq += 1
        return str(700000 + self._seq)

    @staticmethod
    def ok(data):
        return web.json_response({"code": "0", "msg": "", "data": data})

    @staticmethod
    def err(code: str, msg: str, status: int = 200, s_code: str | None = None):
        data = [{"sCode": s_code, "sMsg": msg}] if s_code else []
        return web.json_response({"code": code, "msg": msg if not s_code else "", "data": data}, status=status)

    def _check_auth(self, request: web.Request, body: str) -> bool:
        h = request.headers
        ts = h.get("OK-ACCESS-TIMESTAMP", "")
        prehash = ts + request.method + request.raw_path + body
        expected = base64.b64encode(hmac.new(self.secret.encode(), prehash.encode(), hashlib.sha256).digest()).decode()
        good = (h.get("OK-ACCESS-KEY") == self.api_key and h.get("OK-ACCESS-PASSPHRASE") == self.passphrase
                and hmac.compare_digest(h.get("OK-ACCESS-SIGN", ""), expected))
        if not good:
            self.auth_failures.append(request.raw_path)
        if h.get("x-simulated-trading") != "1":
            self.demo_header_missing.append(request.raw_path)
        return good

    async def handle(self, request: web.Request) -> web.StreamResponse:
        path = request.match_info["tail"]
        body = await request.text()
        payload = json.loads(body) if body else dict(request.query)
        self.log.append((request.method, path, payload))
        if path in self.fail_next:
            status, code, msg, *s_code = self.fail_next.pop(path)
            return self.err(code, msg, status=status, s_code=s_code[0] if s_code else None)
        private = path.startswith(("account/", "trade/"))
        if private and not self._check_auth(request, body):
            return self.err("50113", "Invalid Sign", status=401)
        handler = getattr(self, f"{request.method.lower()}_{path.replace('/', '_').replace('-', '_')}", None)
        if handler is None:
            return self.err("50000", f"mock: unsupported {request.method} {path}", status=404)
        return await handler(payload)

    # ---------- рынок ----------

    def now_ms(self) -> int:
        return int(time.time() * 1000)

    async def get_public_time(self, q):
        return self.ok([{"ts": str(self.now_ms())}])

    async def get_public_instruments(self, q):
        return self.ok([{"instId": i.inst_id, "instType": "SWAP", "ctVal": str(i.ct_val), "lotSz": i.lot_sz,
                         "minSz": i.min_sz, "tickSz": i.tick_sz, "lever": "100", "maxMktSz": "10000",
                         "state": "live", "settleCcy": "USDT"} for i in DEFAULT_INSTRUMENTS.values()])

    async def get_market_ticker(self, q):
        inst = q["instId"]
        return self.ok([{"instId": inst, "last": str(self.prices[inst]), "ts": str(self.now_ms())}])

    async def get_market_candles(self, q):
        inst, limit = q["instId"], int(q.get("limit", 100))
        closes = self.closes[inst]
        last_closed = self.now_ms() // self.tf_ms * self.tf_ms - self.tf_ms
        rows = []
        for k, c in enumerate(closes):
            ts = last_closed - (len(closes) - 1 - k) * self.tf_ms
            o = closes[k - 1] if k else c
            rows.append([str(ts), str(o), str(max(o, c) * 1.001), str(min(o, c) * 0.999), str(c), "1", "", "",
                         "1"])
        cur = self.prices[inst]
        rows.append([str(last_closed + self.tf_ms), str(closes[-1]), str(cur), str(cur), str(cur), "1", "", "", "0"])
        rows.reverse()  # OKX отдаёт от новых к старым
        if "after" in q:
            rows = [r for r in rows if int(r[0]) < int(q["after"])]
        return self.ok(rows[:limit])

    # ---------- аккаунт ----------

    def _ct(self, inst):
        return DEFAULT_INSTRUMENTS[inst].ct_val

    def _upl(self, inst, p: MockPosition) -> float:
        sign = 1 if p.side == "long" else -1
        return sign * (self.prices[inst] - p.avg_px) * p.sz * self._ct(inst)

    def _used_margin(self) -> float:
        return sum(p.sz * self._ct(i) * p.avg_px / p.lever for i, p in self.positions.items())

    async def get_account_config(self, q):
        return self.ok([{"posMode": "net_mode", "acctLv": "2", "uid": "1"}])

    async def get_account_balance(self, q):
        eq = self.cash + sum(self._upl(i, p) for i, p in self.positions.items())
        return self.ok([{"totalEq": str(eq), "details": [
            {"ccy": "USDT", "eq": str(eq), "availBal": str(self.cash - self._used_margin()), "cashBal": str(self.cash)}
        ]}])

    async def post_account_set_leverage(self, q):
        self.leverage[q["instId"]] = int(q["lever"])
        assert q["mgnMode"] == "isolated"
        return self.ok([q])

    async def get_account_positions(self, q):
        out = []
        for inst, p in self.positions.items():
            out.append({"instId": inst, "instType": "SWAP", "posSide": "net", "mgnMode": "isolated",
                        "pos": str(p.sz if p.side == "long" else -p.sz), "avgPx": str(p.avg_px),
                        "upl": str(self._upl(inst, p)), "markPx": str(self.prices[inst]), "lever": str(p.lever),
                        "liqPx": "", "cTime": str(p.c_time)})
        return self.ok(out)

    async def get_account_positions_history(self, q):
        return self.ok([h for h in self.history if h["instId"] == q.get("instId", h["instId"])][::-1])

    # ---------- торговля ----------

    def _close(self, inst: str, price: float, ctype: str = "2"):
        p = self.positions.pop(inst)
        sign = 1 if p.side == "long" else -1
        qty = p.sz * self._ct(inst)
        gross = sign * (price - p.avg_px) * qty
        fee = -qty * price * self.fee_rate
        self.cash += gross + fee
        self.history.append({"instId": inst, "direction": p.side, "type": ctype, "openAvgPx": str(p.avg_px),
                             "closeAvgPx": str(price), "pnl": str(gross), "realizedPnl": str(gross + fee),
                             "fee": str(fee), "fundingFee": "0", "cTime": str(p.c_time), "uTime": str(self.now_ms())})
        for a in [a for a in self.algos.values() if a.inst_id == inst]:
            del self.algos[a.algo_id]  # OKX снимает TP/SL закрытой позиции

    def match_algos(self):
        for a in list(self.algos.values()):
            p = self.positions.get(a.inst_id)
            if p is None or a.algo_id not in self.algos:
                continue
            px = self.prices[a.inst_id]
            long = p.side == "long"
            if a.sl and ((long and px <= a.sl) or (not long and px >= a.sl)):
                self._close(a.inst_id, a.sl)
            elif a.tp and ((long and px >= a.tp) or (not long and px <= a.tp)):
                self._close(a.inst_id, a.tp)

    async def post_trade_order(self, q):
        inst = q["instId"]
        info = DEFAULT_INSTRUMENTS[inst]
        sz = float(q["sz"])
        lots = sz / float(info.lot_sz)
        if abs(lots - round(lots)) > 1e-9 or sz < float(info.min_sz):
            return self.err("1", "Order quantity must be a multiple of the lot size", s_code="51121")
        price = self.prices[inst]
        lever = self.leverage.get(inst, 1)
        margin = sz * info.ct_val * price / lever
        if margin > self.cash - self._used_margin():
            return self.err("1", "Insufficient USDT margin in account", s_code="51008")
        assert q["tdMode"] == "isolated" and q["ordType"] == "market"
        side = "long" if q["side"] == "buy" else "short"
        fee = sz * info.ct_val * price * self.fee_rate
        self.cash -= fee
        self.positions[inst] = MockPosition(side, sz, price, self.now_ms(), lever)
        ord_id = self._id()
        self.orders[ord_id] = {"ordId": ord_id, "clOrdId": q.get("clOrdId", ""), "instId": inst, "state": "filled",
                               "avgPx": str(price), "accFillSz": str(sz), "fee": str(-fee)}
        for att in q.get("attachAlgoOrds", []):
            algo_id = self._id()
            self.algos[algo_id] = MockAlgo(algo_id, inst, "sell" if side == "long" else "buy", sz,
                                           float(att["slTriggerPx"]) if att.get("slTriggerPx") else None,
                                           float(att["tpTriggerPx"]) if att.get("tpTriggerPx") else None,
                                           att.get("attachAlgoClOrdId", ""), "oco")
        return self.ok([{"ordId": ord_id, "clOrdId": q.get("clOrdId", ""), "sCode": "0", "sMsg": ""}])

    async def get_trade_order(self, q):
        for o in self.orders.values():
            if o["ordId"] == q.get("ordId") or (q.get("clOrdId") and o["clOrdId"] == q.get("clOrdId")):
                return self.ok([o])
        return self.err("51603", "Order does not exist")

    def _algo_json(self, a: MockAlgo) -> dict:
        return {"algoId": a.algo_id, "algoClOrdId": a.algo_cl_id, "instId": a.inst_id, "side": a.side,
                "posSide": "net", "sz": str(a.sz), "ordType": a.ord_type, "state": "live",
                "slTriggerPx": str(a.sl or ""), "tpTriggerPx": str(a.tp or ""), "closeFraction": ""}

    async def get_trade_orders_algo_pending(self, q):
        types = set(q.get("ordType", "").split(","))
        return self.ok([self._algo_json(a) for a in self.algos.values()
                        if a.ord_type in types and q.get("instId", a.inst_id) == a.inst_id])

    async def get_trade_order_algo(self, q):
        for a in self.algos.values():
            if a.algo_id == q.get("algoId") or (q.get("algoClOrdId") and a.algo_cl_id == q.get("algoClOrdId")):
                return self.ok([self._algo_json(a)])
        return self.err("51603", "Order does not exist")

    async def post_trade_order_algo(self, q):
        algo_id = self._id()
        self.algos[algo_id] = MockAlgo(algo_id, q["instId"], q["side"], float(q["sz"]),
                                       float(q["slTriggerPx"]) if q.get("slTriggerPx") else None,
                                       float(q["tpTriggerPx"]) if q.get("tpTriggerPx") else None,
                                       q.get("algoClOrdId", ""), q["ordType"])
        return self.ok([{"algoId": algo_id, "sCode": "0", "sMsg": ""}])

    async def post_trade_amend_algos(self, q):
        a = self.algos.get(q["algoId"])
        if a is None:
            return self.err("1", "Algo order does not exist", s_code="51603")
        if q.get("newSlTriggerPx"):
            a.sl = float(q["newSlTriggerPx"])
        if q.get("newTpTriggerPx"):
            a.tp = float(q["newTpTriggerPx"])
        if q.get("newSz"):
            a.sz = float(q["newSz"])
        return self.ok([{"algoId": a.algo_id, "sCode": "0", "sMsg": ""}])

    async def post_trade_cancel_algos(self, q):
        for item in q:
            self.algos.pop(item["algoId"], None)
        return self.ok([{"algoId": i["algoId"], "sCode": "0", "sMsg": ""} for i in q])

    async def get_trade_orders_pending(self, q):
        return self.ok([])

    async def post_trade_close_position(self, q):
        inst = q["instId"]
        if inst not in self.positions:
            return self.err("51023", "Position does not exist")
        self._close(inst, self.prices[inst])
        return self.ok([{"instId": inst, "posSide": q.get("posSide", "net")}])

    # ---------- WebSocket ----------

    async def ws_handler(self, request: web.Request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        pusher = asyncio.create_task(self._push(ws))
        try:
            async for msg in ws:
                if msg.type != WSMsgType.TEXT:
                    continue
                if msg.data == "ping":
                    await ws.send_str("pong")
                    continue
                data = json.loads(msg.data)
                if data.get("op") == "subscribe":
                    for arg in data["args"]:
                        self.ws_subscriptions.add(arg["instId"])
                        await ws.send_str(json.dumps({"event": "subscribe", "arg": arg, "connId": "x"}))
        finally:
            pusher.cancel()
        return ws

    async def _push(self, ws):
        while not ws.closed:
            for inst in list(self.ws_subscriptions):
                await ws.send_str(json.dumps({"arg": {"channel": "tickers", "instId": inst},
                                              "data": [{"instId": inst, "last": str(self.prices[inst]),
                                                        "ts": str(self.now_ms())}]}))
            await asyncio.sleep(0.1)
