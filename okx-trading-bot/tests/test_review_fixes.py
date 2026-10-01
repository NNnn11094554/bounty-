"""Регрессионные тесты на ошибки, найденные при предстартовом ревью."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from telegram.error import BadRequest

from bot.config import ExchangeConfig, Settings
from bot.exchange import OkxClient, okx_bar, select_closed_position
from bot.storage import Storage
from bot.strategies import create_strategy
from bot.trader import HISTORY_WAIT_MS, Trader
from bot.trailing import trail_step
from bot.ws_prices import PriceFeed
from conftest import BTC, ETH, make_signal, make_trade_record, wave_candles


def make_trader(settings, fake, storage, notifier, clock, feed=None):
    t = Trader(settings, fake, storage, create_strategy("ema_cross"), notifier, price_feed=feed, clock=clock)
    t.poll_delay = 0
    return t


# 1. Экстремумы цены до входа не должны включать трейлинг
async def test_price_extremes_before_entry_do_not_trigger_trailing(settings, fake, storage, notifier, clock):
    feed = PriceFeed("ws://unused", [BTC, ETH], fake.fetch_ticker_price, stale_after=1e9)
    t = make_trader(settings, fake, storage, notifier, clock, feed)
    await t.start()
    for px in (60_000, 62_000, 59_000):  # без позиции цена сходила вверх и вернулась
        feed.update(BTC, px)
    fake.set_price(BTC, 59_000)
    trade = await t._open_position(BTC, make_signal("long", 59_000, atr=100))
    await t._manage_positions()
    assert not trade.trailing_active
    assert trade.best_price == 59_000
    assert trade.stop_loss == trade.initial_stop == pytest.approx(58_850)
    assert not fake.amends
    # реальное движение после входа трейлинг включает
    feed.update(BTC, 59_120)
    await t._manage_positions()
    assert trade.trailing_active and trade.stop_loss == pytest.approx(59_020)


# 2. Инструмент убрали из config.yaml при открытой позиции
async def test_position_on_symbol_removed_from_config_stays_protected(settings, fake, storage, notifier, clock):
    t1 = make_trader(settings, fake, storage, notifier, clock)
    await t1.start()
    trade = await t1._open_position(ETH, make_signal("short", 3_000, atr=10))
    algo_id = trade.algo_id

    only_btc = Settings(database_path=":memory:", exchange=ExchangeConfig(symbols=[BTC]))
    t2 = make_trader(only_btc, fake, storage, notifier, clock)
    await t2.start()
    assert ETH in t2.trades
    for _ in range(3):
        clock.advance(HISTORY_WAIT_MS / 1000)
        await t2.reconcile()
    assert algo_id in fake.algos  # стоп живой позиции не снят
    assert storage.get_trade(trade.id).status == "open"
    # сделка доводится до конца по SL/TP на бирже
    fake.set_price(ETH, 2_960)
    fake.trigger(ETH)
    await t2.reconcile()
    closed = storage.get_trade(trade.id)
    assert closed.status == "closed" and closed.close_reason == "take_profit"


# 3. Бары 6H и длиннее у OKX выровнены по Гонконгу — запрашиваем UTC-версию
def test_okx_bar_uses_utc_alignment():
    assert okx_bar("15m") == "15m" and okx_bar("4H") == "4H"
    assert okx_bar("6H") == "6Hutc" and okx_bar("12H") == "12Hutc" and okx_bar("1D") == "1Dutc"


async def test_daily_candles_requested_in_utc():
    c = OkxClient(demo=True)
    try:
        c.ex.public_get_market_candles = AsyncMock(return_value={"code": "0", "data": []})
        await c.fetch_candles(BTC, "1D", limit=10)
        assert c.ex.public_get_market_candles.await_args.args[0]["bar"] == "1Dutc"
    finally:
        await c.close()


@pytest.mark.parametrize("tf", ["1W", "2D", "7m"])
def test_unsupported_timeframes_rejected(tf):
    with pytest.raises(ValueError):
        ExchangeConfig(timeframe=tf)


# 4. Итог сделки не должен браться у предыдущей позиции того же направления
def test_closed_position_ignores_previous_trade():
    t = 1_700_000_000_000
    history = [
        {"instId": BTC, "direction": "long", "type": "2", "cTime": str(t - 3_600_000), "uTime": str(t - 30_000),
         "closeAvgPx": "59000", "realizedPnl": "-80.84"},  # предыдущая сделка, стоп за 30 с до входа
        {"instId": BTC, "direction": "long", "type": "1", "cTime": str(t + 1_000), "uTime": str(t + 600_000),
         "closeAvgPx": "60100", "realizedPnl": "5"},  # частичное закрытие — ещё не итог
        {"instId": BTC, "direction": "long", "type": "2", "cTime": str(t + 1_000), "uTime": str(t + 3_600_000),
         "closeAvgPx": "60300", "realizedPnl": "50.5"},
    ]
    cp = select_closed_position(history, BTC, "long", since_ms=t + 3_000)
    assert cp.realized_pnl == 50.5 and cp.close_avg_px == 60_300
    assert select_closed_position(history[:2], BTC, "long", since_ms=t + 3_000) is None


async def test_back_to_back_trades_get_their_own_results(trader_factory, fake, storage, clock):
    t = await trader_factory()
    a = await t._open_position(BTC, make_signal("long", 60_000, atr=100))
    fake.set_price(BTC, 59_800)
    fake.trigger(BTC)  # стоп по A
    clock.advance(33)  # вход B на следующей свече через 33 с
    await t.reconcile()
    assert storage.get_trade(a.id).close_reason == "stop_loss"
    fake.set_price(BTC, 59_800)
    b = await t._open_position(BTC, make_signal("long", 59_800, atr=100))
    clock.advance(3_600)
    fake.set_price(BTC, 60_150)
    fake.trigger(BTC)  # тейк по B
    await t.reconcile()
    b_closed = storage.get_trade(b.id)
    assert b_closed.close_reason == "take_profit" and b_closed.pnl > 0
    assert b_closed.exit_price == pytest.approx(60_100)


# 5. Задержка истории OKX: ждём по времени, а не по числу попыток
async def test_market_close_waits_for_exchange_history(trader_factory, fake, storage, clock):
    t = await trader_factory()
    trade = await t._open_position(BTC, make_signal("long", 60_000, atr=100))
    fake.history_visible = False
    fake.set_price(BTC, 59_500)
    await t._close_trade_market(trade, "opposite_signal")
    assert storage.get_trade(trade.id).status == "open"  # не оценили PnL наугад
    await t.reconcile()
    assert BTC in t.trades
    fake.history_visible = True
    await t.reconcile()
    closed = storage.get_trade(trade.id)
    assert closed.status == "closed" and closed.close_reason == "opposite_signal"
    assert closed.fee is not None and closed.fee < 0  # точный итог OKX с комиссией
    assert closed.pnl == pytest.approx(-500 * trade.qty + closed.fee)


async def test_estimate_only_after_wait_and_only_without_position(trader_factory, fake, storage, clock):
    t = await trader_factory()
    trade = await t._open_position(BTC, make_signal("long", 60_000, atr=100))
    algo_id = trade.algo_id
    # сбой биржи: пустой список позиций, хотя позиция есть
    fake.empty_positions = 1
    await t.reconcile()
    clock.advance(HISTORY_WAIT_MS / 1000 + 1)
    fake.empty_positions = 1
    await t.reconcile()
    assert storage.get_trade(trade.id).status == "open"
    assert algo_id in fake.algos  # SL/TP живой позиции не тронуты
    # позиция закрыта, а история так и не пришла — через 2 минуты оцениваем по цене
    fake.history_visible = False
    fake.set_price(BTC, 59_700)
    fake.trigger(BTC)
    await t.reconcile()
    assert storage.get_trade(trade.id).status == "open"
    clock.advance(HISTORY_WAIT_MS / 1000 + 1)
    await t.reconcile()
    est = storage.get_trade(trade.id)
    assert est.status == "closed" and est.fee is None


# 6. Режим маржи — у позиции, а не из config
async def test_adopted_cross_position_closed_with_its_margin_mode(trader_factory, fake, storage):
    fake.open_manual(BTC, "long", 0.5, 60_000, mgn_mode="cross")
    fake.candles[BTC] = wave_candles(start=50_000)
    t = await trader_factory()
    trade = t.trades[BTC]
    assert trade.mgn_mode == "cross" and storage.get_trade(trade.id).mgn_mode == "cross"
    assert fake.placed_algos[-1]["td_mode"] == "cross"
    await t._close_trade_market(trade, "opposite_signal")
    assert fake.closed_calls[-1] == (BTC, "cross")


def test_old_database_is_migrated(tmp_path):
    import sqlite3
    path = tmp_path / "old.db"
    db = sqlite3.connect(path)
    db.executescript(open("bot/storage.py", encoding="utf-8").read().split('SCHEMA = """')[1].split('"""')[0]
                     .replace(",\n    mgn_mode        TEXT NOT NULL DEFAULT 'isolated'", ""))
    db.execute("INSERT INTO trades (inst_id, side, pos_side, mode, contracts, ct_val, entry_price, stop_loss, "
               "initial_stop, opened_at) VALUES ('BTC-USDT-SWAP', 'long', 'net', 'DEMO', 1, 0.01, 1, 1, 1, 1)")
    db.commit()
    db.close()
    [t] = Storage(str(path)).open_trades()
    assert t.mgn_mode == "isolated"


# 9. Две открытые записи об одной позиции
async def test_duplicate_open_records_are_merged(trader_factory, fake, storage):
    fake.open_manual(BTC, "long", 1.0, 60_000)
    old = make_trade_record(storage, contracts=1.0)
    new = make_trade_record(storage, contracts=1.0)
    t = await trader_factory()
    assert t.trades[BTC].id == new
    assert storage.get_trade(old).status == "merged"
    assert [x.id for x in storage.open_trades()] == [new]
    assert storage.closed_trades() == []  # дубль не попадает в статистику


# 10. Итог аварийного закрытия — по свежему списку позиций
async def test_close_all_reports_by_fresh_positions(trader_factory, fake):
    t = await trader_factory()
    await t._open_position(BTC, make_signal("long"))
    fake.stubborn_close[BTC] = 4  # закроется только с пятой попытки
    result = await t.close_all()
    assert result.remaining == [] and result.positions_closed == 1
    assert not fake.positions


# 11. Ответы Telegram с текстом ошибки биржи
@pytest.fixture
def tg():
    from bot.telegram_bot import TelegramBot
    return TelegramBot("123456:TEST-token-for-unit-tests", chat_id=42)


def _update():
    upd = MagicMock()
    upd.effective_chat.id = 42
    upd.effective_message.reply_text = AsyncMock()
    return upd


async def test_status_error_with_html_is_escaped(tg):
    trader = MagicMock(ready=True)
    trader.status_view = AsyncMock(side_effect=RuntimeError("<html><title>502 Bad Gateway</title></html>"))
    tg.attach(trader)
    upd = _update()
    await tg.cmd_status(upd, MagicMock())
    text = upd.effective_message.reply_text.await_args.args[0]
    assert "&lt;html&gt;" in text and "<html>" not in text


async def test_reply_falls_back_to_plain_text(tg):
    upd = _update()
    upd.effective_message.reply_text.side_effect = [BadRequest("Can't parse entities"), None]
    await tg._reply(upd, "<b>жирный</b> <oops>")
    assert upd.effective_message.reply_text.await_count == 2
    assert upd.effective_message.reply_text.await_args.args[0] == "жирный "


# общее правило трейлинга
def test_trail_step_rules():
    kw = dict(entry=100.0, atr=1.0, activation=1.0, distance=1.0, tick=0.1, min_step_atr=0.1,
              round_price=lambda x: round(x, 1))
    s = trail_step(side="long", stop=98.5, best=100.0, active=False, high=100.5, low=99.8, **kw)
    assert not s.active and s.new_stop is None and s.best_price == 100.5
    s = trail_step(side="long", stop=98.5, best=100.5, active=False, high=101.0, low=100.2, **kw)
    assert s.activated_now and s.new_stop == pytest.approx(100.0)
    s = trail_step(side="long", stop=100.0, best=101.0, active=True, high=101.05, low=100.9, **kw)
    assert s.new_stop is None  # улучшение меньше 0.1 ATR
    s = trail_step(side="short", stop=101.5, best=100.0, active=False, high=99.5, low=99.0, **kw)
    assert s.activated_now and s.new_stop == pytest.approx(100.0)
    s = trail_step(side="long", stop=98.5, best=100.0, active=False, high=105, low=99, entry=100.0, atr=1.0,
                   activation=None, distance=None, tick=0.1, min_step_atr=0.1, round_price=lambda x: x)
    assert s.new_stop is None and not s.active
