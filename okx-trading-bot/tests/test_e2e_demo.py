"""Сквозной прогон DEMO-режима: настоящие OkxClient (ccxt, подпись, ретраи), WebSocket-цены, SQLite и
торговый цикл против локального мока OKX. Проверяет вход с SL/TP на бирже, трейлинг, перезапуск без дублей,
закрытие по тейку и обработку ошибок OKX (rate limit, недостаток маржи)."""

import asyncio
import time

import pytest
from aiohttp import web

from bot.config import ExchangeConfig, LoggingConfig, Secrets, Settings, TradingConfig
from bot.main import build_components
from bot.strategies import create_strategy
from conftest import BTC, ETH, RecordingNotifier, wave_candles
from mock_okx import MockOkx

KEY, SECRET, PASS = "demo-key-0001", "demo-secret-0002", "demo-pass-0003"


async def wait_until(cond, timeout=15.0, what=""):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if cond():
            return
        await asyncio.sleep(0.05)
    raise AssertionError(f"не дождались: {what}")


def closes_ending_with_signal(start: float, want_signal: bool) -> list[float]:
    c = wave_candles(n=600, start=start)
    strat = create_strategy("ema_cross")
    ind = strat.compute(c)
    for k in range(len(c) - 1, 250, -1):
        sig = strat.signal_at(c, ind, k)
        if (sig is not None and sig.side == "long") == want_signal:
            return [float(x) for x in c.close[:k + 1]]
    raise AssertionError("подходящий бар не найден")


class Bot:
    def __init__(self, settings: Settings, port: int):
        self.storage, self.client, _, self.feed, self.trader = build_components(settings)
        self.client.ex.urls["api"]["rest"] = f"http://127.0.0.1:{port}"  # вместо https://www.okx.com
        self.notifier = RecordingNotifier()
        self.trader.notifier = self.notifier
        self.tasks = [asyncio.create_task(self.feed.run()), asyncio.create_task(self.trader.run())]

    async def stop(self):
        self.trader.stop()
        await self.feed.stop()
        await asyncio.wait_for(self.tasks[1], 10)
        self.tasks[0].cancel()
        await self.client.close()
        self.storage.close()


@pytest.fixture
async def mock_server():
    mock = MockOkx(api_key=KEY, secret=SECRET, passphrase=PASS,
                   closes={BTC: closes_ending_with_signal(60_000, True),
                           ETH: closes_ending_with_signal(3_000, False)})
    mock.prices = {BTC: mock.closes[BTC][-1], ETH: mock.closes[ETH][-1]}
    runner = web.AppRunner(mock.app())
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", 0)
    await site.start()
    port = site._server.sockets[0].getsockname()[1]  # noqa: SLF001
    yield mock, port
    await runner.cleanup()


def demo_settings(tmp_path, port) -> Settings:
    return Settings(
        database_path=str(tmp_path / "bot.db"),
        exchange=ExchangeConfig(ws_url_demo=f"ws://127.0.0.1:{port}/ws/v5/public",
                                ws_url_live="wss://must-not-be-used.invalid"),
        trading=TradingConfig(loop_interval_sec=0.1, reconcile_interval_sec=0.3, candle_close_delay_sec=0,
                              signal_max_delay_sec=900),
        logging=LoggingConfig(file=""),
        secrets=Secrets(okx_api_key=KEY, okx_api_secret=SECRET, okx_api_passphrase=PASS, live_trading=False),
    )


async def test_demo_mode_end_to_end(tmp_path, mock_server):
    mock, port = mock_server
    settings = demo_settings(tmp_path, port)
    assert settings.mode == "DEMO"
    # первая попытка получить баланс — rate limit (HTTP 429, 50011), первый ордер — нехватка маржи (51008)
    mock.fail_next["account/balance"] = (429, "50011", "Too Many Requests")
    mock.fail_next["trade/order"] = (200, "1", "Insufficient USDT margin in account", "51008")

    bot = Bot(settings, port)
    try:
        await wait_until(lambda: bot.notifier.has("LONG BTC-USDT-SWAP"), what="открытие сделки по сигналу")
        [trade] = bot.storage.open_trades()
        entry_price = mock.prices[BTC]

        # все приватные запросы подписаны верно и шли в демо-режим
        assert mock.auth_failures == []
        assert mock.demo_header_missing == []
        assert mock.leverage == {BTC: 3, ETH: 3}
        orders = mock.calls("POST", "trade/order")
        assert len(orders) == 2  # 51008 → повтор с меньшим объёмом
        assert float(orders[1]["sz"]) < float(orders[0]["sz"])
        att = orders[1]["attachAlgoOrds"][0]
        assert att["slOrdPx"] == "-1" and att["tpOrdPx"] == "-1"
        assert orders[1]["tdMode"] == "isolated"

        # позиция и её SL/TP — на бирже
        pos = mock.positions[BTC]
        assert pos.side == "long" and pos.sz == pytest.approx(trade.contracts)
        [algo] = mock.algos.values()
        assert algo.sl == pytest.approx(trade.stop_loss) and algo.tp == pytest.approx(trade.take_profit)
        assert trade.entry_price == pytest.approx(entry_price)
        assert trade.stop_loss == pytest.approx(entry_price - 1.5 * trade.atr, abs=0.1)
        assert trade.take_profit == pytest.approx(entry_price + 3.0 * trade.atr, abs=0.1)
        assert bot.notifier.has("LONG BTC-USDT-SWAP")
        await wait_until(lambda: bot.feed.connected, what="WebSocket")

        # цена +1.2 ATR → трейлинг: стоп переносится на бирже через amend-algos
        mock.prices[BTC] = entry_price + 1.2 * trade.atr
        await wait_until(lambda: mock.calls("POST", "trade/amend-algos") and algo.sl > entry_price,
                         what="перенос стопа")
        await wait_until(lambda: bot.storage.get_trade(trade.id).trailing_active, what="трейлинг в БД")
        moved_sl = algo.sl
        assert moved_sl == pytest.approx(entry_price + 0.2 * trade.atr, abs=0.2)
    finally:
        await bot.stop()

    # перезапуск: позиция подхвачена из БД, дублей и лишних ордеров нет
    n_orders = len(mock.calls("POST", "trade/order"))
    n_algos = len(mock.calls("POST", "trade/order-algo"))
    bot2 = Bot(settings, port)
    try:
        await wait_until(lambda: bot2.trader.ready, what="запуск после рестарта")
        await asyncio.sleep(0.5)
        assert len(mock.calls("POST", "trade/order")) == n_orders
        assert len(mock.calls("POST", "trade/order-algo")) == n_algos
        assert bot2.trader.trades[BTC].id == trade.id
        assert not bot2.notifier.has("Найдена открытая позиция")

        # цена дошла до тейка — биржа закрывает позицию, бот фиксирует результат
        mock.prices[BTC] = trade.take_profit + 1
        await wait_until(lambda: bot2.notifier.has("Закрыта LONG BTC-USDT-SWAP"), what="закрытие по тейку")
        closed = bot2.storage.get_trade(trade.id)
        assert closed.status == "closed" and closed.close_reason == "take_profit"
        assert closed.exit_price == pytest.approx(trade.take_profit)
        assert closed.pnl > 0
        assert bot2.notifier.has("Закрыта LONG BTC-USDT-SWAP")
        assert mock.auth_failures == [] and mock.demo_header_missing == []
    finally:
        await bot2.stop()
