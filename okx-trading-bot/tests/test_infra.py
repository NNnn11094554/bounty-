"""Конфиг, SQLite, WebSocket-цены, Telegram, логи."""

import json
import logging
from unittest.mock import AsyncMock, MagicMock

import pytest

from bot import messages
from bot.config import Settings, load_settings, secrets_from_env, timeframe_to_ms
from bot.logger import SecretFilter
from bot.models import Trade
from bot.notifier import Notifier
from bot.storage import Storage
from bot.ws_prices import PriceFeed


# ---------- конфиг ----------

@pytest.mark.parametrize("value,live", [("", False), ("false", False), ("0", False), ("no", False),
                                        ("LIVE", False), ("true", True), ("TRUE", True), ("1", True)])
def test_live_only_with_explicit_flag(monkeypatch, value, live):
    monkeypatch.setenv("LIVE_TRADING", value)
    s = Settings(secrets=secrets_from_env())
    assert s.demo is (not live)
    assert s.mode == ("LIVE" if live else "DEMO")


def test_demo_by_default(monkeypatch, tmp_path):
    monkeypatch.delenv("LIVE_TRADING", raising=False)
    s = load_settings(tmp_path / "missing.yaml", env_file=None)
    assert s.demo and s.ws_url.startswith("wss://wspap.okx.com")
    assert s.exchange.symbols == ["BTC-USDT-SWAP", "ETH-USDT-SWAP"]
    assert s.exchange.leverage == 3 and s.exchange.margin_mode == "isolated"
    assert s.risk.risk_per_trade_pct == 1 and s.risk.max_open_positions == 2 and s.risk.daily_loss_limit_pct == 5


def test_project_config_and_env(tmp_path, monkeypatch):
    for k in ("OKX_API_KEY", "OKX_API_SECRET", "OKX_API_PASSPHRASE", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
              "LIVE_TRADING"):
        monkeypatch.delenv(k, raising=False)
    env = tmp_path / ".env"
    env.write_text("OKX_API_KEY=key123456\nOKX_API_SECRET=secret123456\nOKX_API_PASSPHRASE=pass123456\n"
                   "TELEGRAM_BOT_TOKEN=1:tok\nTELEGRAM_CHAT_ID=42\n")
    s = load_settings("config.yaml", env_file=str(env))
    assert s.secrets.has_okx_keys and s.secrets.telegram_enabled and s.secrets.telegram_chat_id == 42
    assert s.demo
    assert s.strategy.name == "ema_cross" and s.strategy.params["tp_atr"] == 3.0
    assert s.backtest.months == 6


def test_secrets_are_not_read_from_yaml(tmp_path, monkeypatch):
    monkeypatch.delenv("OKX_API_KEY", raising=False)
    cfg = tmp_path / "c.yaml"
    cfg.write_text("secrets:\n  okx_api_key: leaked\n")
    assert load_settings(cfg, env_file=None).secrets.okx_api_key == ""


@pytest.mark.parametrize("bad", [{"exchange": {"symbols": ["BTC-USDT"]}}, {"exchange": {"timeframe": "15x"}},
                                 {"risk": {"risk_per_trade_pct": 0}}, {"exchange": {"leverage": 0}},
                                 {"risk": {"day_reset_timezone": "Mars/Base"}}, {"unknown_section": {}}])
def test_invalid_config_rejected(bad):
    with pytest.raises(Exception):
        Settings(**bad)


def test_timeframes():
    assert timeframe_to_ms("15m") == 900_000
    assert timeframe_to_ms("4H") == 14_400_000
    assert timeframe_to_ms("1D") == 86_400_000


def test_env_example_and_gitignore():
    example = open(".env.example", encoding="utf-8").read()
    for key in ("OKX_API_KEY", "OKX_API_SECRET", "OKX_API_PASSPHRASE", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
                "LIVE_TRADING=false"):
        assert key in example
    assert ".env" in open(".gitignore", encoding="utf-8").read().splitlines()


# ---------- SQLite ----------

def make_trade(**kw):
    base = dict(inst_id="BTC-USDT-SWAP", side="long", pos_side="net", contracts=1.0, entry_price=60_000,
                stop_loss=59_850, take_profit=60_300, initial_stop=59_850, atr=100, trail_activation=100,
                trail_distance=100, opened_at=1_000, ct_val=0.01)
    base.update(kw)
    return Trade(**base)


def test_storage_trade_lifecycle_survives_restart(tmp_path):
    path = str(tmp_path / "bot.db")
    s = Storage(path)
    t = make_trade()
    s.insert_trade(t)
    t.stop_loss, t.trailing_active = 60_000, True
    s.update_trade(t, "stop_loss", "trailing_active")
    s.set_state("paused", True)
    s.set_state("day_start_equity", 1234.5)
    s.close()

    s2 = Storage(path)
    [loaded] = s2.open_trades()
    assert loaded.stop_loss == 60_000 and loaded.trailing_active is True and loaded.take_profit == 60_300
    assert s2.get_state("paused") is True and s2.get_state("day_start_equity") == 1234.5
    loaded.status, loaded.pnl, loaded.closed_at, loaded.close_reason = "closed", 2.5, 5_000, "take_profit"
    s2.update_trade(loaded)
    assert s2.open_trades() == []
    assert [x.pnl for x in s2.closed_trades(since_ms=4_000)] == [2.5]
    assert s2.closed_trades(since_ms=6_000) == []
    assert s2.realized_pnl(0) == 2.5
    assert s2.get_state("missing", "dflt") == "dflt"
    s2.close()


# ---------- WebSocket ----------

async def test_price_feed_ws_messages_and_ranges():
    rest = AsyncMock(return_value=1.0)
    feed = PriceFeed("wss://example", ["BTC-USDT-SWAP"], rest)
    feed.handle_message(json.dumps({"event": "subscribe", "arg": {"channel": "tickers"}}))
    for px in (100.0, 105.0, 98.0, 101.0):
        feed.handle_message(json.dumps({"arg": {"channel": "tickers", "instId": "BTC-USDT-SWAP"},
                                        "data": [{"instId": "BTC-USDT-SWAP", "last": str(px)}]}))
    feed.handle_message("pong")
    assert await feed.get_price("BTC-USDT-SWAP") == 101.0
    assert await feed.take_range("BTC-USDT-SWAP") == (101.0, 105.0, 98.0)
    assert await feed.take_range("BTC-USDT-SWAP") == (101.0, 101.0, 101.0)  # экстремумы сброшены
    rest.assert_not_awaited()


async def test_price_feed_falls_back_to_rest_when_stale():
    rest = AsyncMock(return_value=123.0)
    feed = PriceFeed("wss://example", ["ETH-USDT-SWAP"], rest, stale_after=0.0)
    feed.update("ETH-USDT-SWAP", 100.0)
    feed._quotes["ETH-USDT-SWAP"].ts -= 10
    assert await feed.get_price("ETH-USDT-SWAP") == 123.0
    rest.assert_awaited_once_with("ETH-USDT-SWAP")


# ---------- уведомления и Telegram ----------

async def test_error_notifications_are_throttled():
    sent = []

    class N(Notifier):
        async def send(self, text):
            sent.append(text)

    n = N()
    await n.error("k", "a")
    await n.error("k", "b")
    await n.error("other", "c")
    assert sent == ["a", "c"]


async def test_notifier_never_raises():
    class Broken(Notifier):
        async def send(self, text):
            raise RuntimeError("telegram down")

    await Broken().notify("x")


@pytest.fixture
def tg():
    from bot.telegram_bot import TelegramBot
    return TelegramBot("123456:TEST-token-for-unit-tests", chat_id=42)


def test_telegram_commands_restricted_to_owner(tg):
    from telegram.ext import CommandHandler, filters
    cmds = [h for h in tg.app.handlers[0] if isinstance(h, CommandHandler)]
    names = {c for h in cmds for c in h.commands}
    assert {"status", "stop", "start", "closeall", "report"} <= names
    for h in cmds:
        assert isinstance(h.filters, filters.Chat) and h.filters.chat_ids == {42}


def _update(chat_id=42):
    upd = MagicMock()
    upd.effective_chat.id = chat_id
    upd.effective_message.reply_text = AsyncMock()
    upd.callback_query.answer = AsyncMock()
    upd.callback_query.edit_message_text = AsyncMock()
    return upd


async def test_telegram_stop_start(tg):
    trader = MagicMock(mode="DEMO", daily_limit_hit=False, ready=True)
    tg.attach(trader)
    upd = _update()
    await tg.cmd_stop(upd, MagicMock())
    trader.set_paused.assert_called_with(True)
    await tg.cmd_start(upd, MagicMock())
    trader.set_paused.assert_called_with(False)
    assert "возобновлена" in upd.effective_message.reply_text.await_args.args[0]


async def test_telegram_closeall_requires_confirmation_and_owner(tg):
    trader = MagicMock(ready=True)
    trader.close_all = AsyncMock(return_value=MagicMock(remaining=[]))
    tg.attach(trader)
    await tg.cmd_closeall(_update(), MagicMock())
    trader.close_all.assert_not_awaited()  # сначала только вопрос с кнопками
    stranger = _update(chat_id=999)
    stranger.callback_query.data = "closeall:yes"
    await tg.on_callback(stranger, MagicMock())
    trader.close_all.assert_not_awaited()
    owner = _update()
    owner.callback_query.data = "closeall:yes"
    await tg.on_callback(owner, MagicMock())
    trader.close_all.assert_awaited_once()


async def test_telegram_report_args(tg):
    trader = MagicMock()
    trader.report_text = MagicMock(return_value="R")
    tg.attach(trader)
    ctx = MagicMock(args=["7"])
    await tg.cmd_report(_update(), ctx)
    trader.report_text.assert_called_with(7)


def test_status_message_format():
    view = messages.StatusView(mode="DEMO", state="▶️ работает", equity=1012.3, available=800, day_pnl=12.3,
                               day_pnl_pct=1.23, realized_today=5, trades_today=1, daily_limit_pct=5,
                               positions=[messages.PositionView("BTC-USDT-SWAP", "long", 1.04, 60_000, 60_200,
                                                                2.08, 59_850, 60_300, True)])
    text = messages.status(view)
    assert "1,012.30" in text and "+12.30" in text and "LONG BTC-USDT-SWAP" in text and "трейлинг" in text


# ---------- логи ----------

def test_secret_filter_redacts():
    rec = logging.LogRecord("x", logging.INFO, "f", 1, "key=%s ok", ("SUPERSECRET",), None)
    SecretFilter(["SUPERSECRET"]).filter(rec)
    assert rec.getMessage() == "key=*** ok"
