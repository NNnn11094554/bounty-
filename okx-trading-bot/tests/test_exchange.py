"""Клиент OKX: ретраи, идемпотентность ордеров, demo-заголовок, разбор ответов. Сеть не используется."""

from unittest.mock import AsyncMock

import pytest
from ccxt.base.errors import InsufficientFunds, NetworkError, RateLimitExceeded, RequestTimeout

from bot.exchange import OkxClient, new_client_id, with_retries


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch):
    monkeypatch.setattr("bot.exchange.backoff_delay", lambda *a, **k: 0)


@pytest.fixture
async def client():
    c = OkxClient(api_key="k", secret="s", passphrase="p", demo=True)
    yield c
    await c.close()


async def _no_sleep(_):
    return None


async def test_retries_network_errors_then_succeeds():
    fn = AsyncMock(side_effect=[RequestTimeout("t"), RateLimitExceeded("50011"), "ok"])
    assert await with_retries(fn, attempts=5, sleep=_no_sleep) == "ok"
    assert fn.await_count == 3


async def test_does_not_retry_business_errors():
    fn = AsyncMock(side_effect=InsufficientFunds("51008"))
    with pytest.raises(InsufficientFunds):
        await with_retries(fn, attempts=5, sleep=_no_sleep)
    assert fn.await_count == 1


async def test_gives_up_after_attempts():
    fn = AsyncMock(side_effect=NetworkError("down"))
    with pytest.raises(NetworkError):
        await with_retries(fn, attempts=3, sleep=_no_sleep)
    assert fn.await_count == 3


async def test_demo_header_and_live_mode():
    demo = OkxClient(demo=True)
    live = OkxClient(demo=False)
    try:
        assert demo.ex.headers.get("x-simulated-trading") == "1"
        assert "x-simulated-trading" not in (live.ex.headers or {})
        assert demo.ex.enableRateLimit and live.ex.enableRateLimit
    finally:
        await demo.close()
        await live.close()


def test_client_ids_are_okx_compatible():
    ids = {new_client_id("e") for _ in range(100)}
    assert len(ids) == 100
    for i in ids:
        assert len(i) <= 32 and i.isalnum() and i.startswith("okxb")


async def test_market_order_payload_with_attached_sl_tp(client):
    client.ex.private_post_trade_order = AsyncMock(return_value={"code": "0", "data": [{"ordId": "777"}]})
    ord_id = await client.place_market_order(inst_id="BTC-USDT-SWAP", side="buy", sz="1.04", td_mode="isolated",
                                             pos_side="net", cl_ord_id="okxbe1", sl_trigger="59850.0",
                                             tp_trigger="60300.0", attach_algo_cl_id="okxba1")
    assert ord_id == "777"
    params = client.ex.private_post_trade_order.await_args.args[0]
    assert params["ordType"] == "market" and params["tdMode"] == "isolated" and params["sz"] == "1.04"
    assert "posSide" not in params  # net-режим
    attach = params["attachAlgoOrds"][0]
    assert attach["slTriggerPx"] == "59850.0" and attach["slOrdPx"] == "-1"
    assert attach["tpTriggerPx"] == "60300.0" and attach["tpOrdPx"] == "-1"
    assert attach["attachAlgoClOrdId"] == "okxba1"


async def test_market_order_hedge_mode_sets_pos_side(client):
    client.ex.private_post_trade_order = AsyncMock(return_value={"code": "0", "data": [{"ordId": "1"}]})
    await client.place_market_order(inst_id="ETH-USDT-SWAP", side="sell", sz="2", td_mode="isolated",
                                    pos_side="short", cl_ord_id="okxbe2")
    assert client.ex.private_post_trade_order.await_args.args[0]["posSide"] == "short"


async def test_order_not_duplicated_after_timeout(client):
    """Таймаут при отправке: ордер мог дойти — проверяем по clOrdId вместо повторной отправки."""
    client.ex.private_post_trade_order = AsyncMock(side_effect=RequestTimeout("timeout"))
    client.ex.private_get_trade_order = AsyncMock(return_value={"code": "0", "data": [
        {"ordId": "555", "state": "filled", "avgPx": "60000", "accFillSz": "1"}]})
    ord_id = await client.place_market_order(inst_id="BTC-USDT-SWAP", side="buy", sz="1", td_mode="isolated",
                                             pos_side="net", cl_ord_id="okxbe3")
    assert ord_id == "555"
    assert client.ex.private_post_trade_order.await_count == 1
    assert client.ex.private_get_trade_order.await_args.args[0]["clOrdId"] == "okxbe3"


async def test_order_retried_when_it_did_not_reach_exchange(client):
    client.ex.private_post_trade_order = AsyncMock(side_effect=[RequestTimeout("t"), {"code": "0",
                                                                                      "data": [{"ordId": "9"}]}])
    client.ex.private_get_trade_order = AsyncMock(return_value={"code": "0", "data": []})
    assert await client.place_market_order(inst_id="BTC-USDT-SWAP", side="buy", sz="1", td_mode="isolated",
                                           pos_side="net", cl_ord_id="okxbe4") == "9"
    assert client.ex.private_post_trade_order.await_count == 2


async def test_insufficient_funds_propagates_without_retry(client):
    client.ex.private_post_trade_order = AsyncMock(side_effect=InsufficientFunds("okx 51008"))
    with pytest.raises(InsufficientFunds):
        await client.place_market_order(inst_id="BTC-USDT-SWAP", side="buy", sz="1", td_mode="isolated",
                                        pos_side="net", cl_ord_id="okxbe5")
    assert client.ex.private_post_trade_order.await_count == 1


async def test_tpsl_payload(client):
    client.ex.private_post_trade_order_algo = AsyncMock(return_value={"code": "0", "data": [{"algoId": "A1"}]})
    algo_id = await client.place_tpsl(inst_id="BTC-USDT-SWAP", close_side="sell", pos_side="net",
                                      td_mode="isolated", sz="1", sl_trigger="59000", tp_trigger="62000",
                                      algo_cl_id="okxbs1", trigger_px_type="mark")
    assert algo_id == "A1"
    p = client.ex.private_post_trade_order_algo.await_args.args[0]
    assert p["ordType"] == "oco" and p["reduceOnly"] is True and p["side"] == "sell"
    assert p["slOrdPx"] == "-1" and p["tpOrdPx"] == "-1" and p["slTriggerPxType"] == "mark"
    client.ex.private_post_trade_order_algo.reset_mock()
    await client.place_tpsl(inst_id="BTC-USDT-SWAP", close_side="sell", pos_side="long", td_mode="isolated",
                            sz="1", sl_trigger="59000", tp_trigger=None, algo_cl_id="okxbs2")
    p = client.ex.private_post_trade_order_algo.await_args.args[0]
    assert p["ordType"] == "conditional" and p["posSide"] == "long" and "reduceOnly" not in p


async def test_amend_and_cancel_payloads(client):
    client.ex.private_post_trade_amend_algos = AsyncMock(return_value={"code": "0", "data": [{}]})
    await client.amend_tpsl(inst_id="BTC-USDT-SWAP", algo_id="A1", sl_trigger="60000")
    p = client.ex.private_post_trade_amend_algos.await_args.args[0]
    assert p == {"instId": "BTC-USDT-SWAP", "algoId": "A1", "newSlTriggerPx": "60000", "newSlOrdPx": "-1",
                 "newSlTriggerPxType": "last"}
    client.ex.private_post_trade_cancel_algos = AsyncMock(return_value={"code": "0", "data": []})
    await client.cancel_algos([("BTC-USDT-SWAP", str(i)) for i in range(23)])
    assert client.ex.private_post_trade_cancel_algos.await_count == 3  # не больше 10 за запрос
    assert isinstance(client.ex.private_post_trade_cancel_algos.await_args_list[0].args[0], list)


async def test_parse_positions_balance_instruments(client):
    client.ex.private_get_account_positions = AsyncMock(return_value={"code": "0", "data": [
        {"instId": "BTC-USDT-SWAP", "pos": "-1.5", "posSide": "net", "avgPx": "60000", "upl": "-3.2",
         "markPx": "60100", "liqPx": "79000", "lever": "3", "mgnMode": "isolated", "cTime": "1700000000000"},
        {"instId": "ETH-USDT-SWAP", "pos": "0", "posSide": "net", "avgPx": ""},
        {"instId": "ETH-USDT-SWAP", "pos": "2", "posSide": "long", "avgPx": "3000"},
    ]})
    positions = await client.get_positions()
    assert len(positions) == 2
    btc, eth = positions
    assert btc.side == "short" and btc.contracts == 1.5 and btc.avg_px == 60000 and btc.c_time == 1700000000000
    assert eth.side == "long" and eth.pos_side == "long"

    client.ex.private_get_account_balance = AsyncMock(return_value={"code": "0", "data": [
        {"totalEq": "5000", "details": [{"ccy": "USDT", "eq": "1234.5", "availBal": "0", "cashBal": "1200"}]}]})
    bal = await client.get_balance()
    assert bal.equity == 1234.5 and bal.available == 0.0  # «0» — это значение, а не отсутствие данных

    client.ex.public_get_public_instruments = AsyncMock(return_value={"code": "0", "data": [
        {"instId": "BTC-USDT-SWAP", "ctVal": "0.01", "lotSz": "0.01", "minSz": "0.01", "tickSz": "0.1",
         "lever": "100", "maxMktSz": "10000", "state": "live"}]})
    inst = (await client.load_instruments(["BTC-USDT-SWAP"]))["BTC-USDT-SWAP"]
    assert inst.ct_val == 0.01 and inst.tick_sz == "0.1" and inst.max_mkt_sz == 10000
    with pytest.raises(ValueError):
        await client.load_instruments(["DOGE-USDT-SWAP"])


async def test_candles_only_closed_and_ascending(client):
    client.ex.public_get_market_candles = AsyncMock(return_value={"code": "0", "data": [
        ["3000", "4", "5", "3", "4.5", "1", "", "", "0"],  # текущая, не закрыта
        ["2000", "3", "4", "2", "3.5", "1", "", "", "1"],
        ["1000", "2", "3", "1", "2.5", "1", "", "", "1"],
    ]})
    c = await client.fetch_candles("BTC-USDT-SWAP", "15m", limit=10)
    assert list(c.ts) == [1000, 2000]
    assert list(c.close) == [2.5, 3.5]


async def test_closed_position_lookup(client):
    client.ex.private_get_account_positions_history = AsyncMock(return_value={"code": "0", "data": [
        {"instId": "BTC-USDT-SWAP", "direction": "long", "type": "2", "uTime": "5000000", "openAvgPx": "60000",
         "closeAvgPx": "60300", "realizedPnl": "2.7", "fee": "-0.3", "fundingFee": "0"},
        {"instId": "BTC-USDT-SWAP", "direction": "long", "type": "2", "uTime": "100", "realizedPnl": "-9"},
        {"instId": "BTC-USDT-SWAP", "direction": "short", "type": "2", "uTime": "6000000", "realizedPnl": "1"},
    ]})
    cp = await client.get_closed_position("BTC-USDT-SWAP", "long", since_ms=4_000_000)
    assert cp.realized_pnl == 2.7 and cp.close_avg_px == 60300 and cp.close_type == "2"
    assert await client.get_closed_position("BTC-USDT-SWAP", "short", since_ms=7_000_000) is None
