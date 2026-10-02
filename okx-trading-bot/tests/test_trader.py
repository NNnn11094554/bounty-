"""Сценарии торгового ядра на биржe-заглушке: вход, SL/TP на бирже, трейлинг, сверка,
лимиты, перезапуск, аварийное закрытие."""

import pytest
from ccxt.base.errors import RequestTimeout

from bot.config import RiskConfig, Settings
from bot.models import Candles, Trade
from bot.risk import calculate_position_size
from bot.strategies import create_strategy
from bot.trader import Trader
from conftest import BTC, ETH, T0, make_signal


def make_trader(settings, fake, storage, notifier, clock, strategy=None):
    t = Trader(settings, fake, storage, strategy or create_strategy("ema_cross"), notifier, clock=clock)
    t.poll_delay = 0
    return t


@pytest.fixture
async def trader(settings, fake, storage, notifier, clock):
    t = make_trader(settings, fake, storage, notifier, clock)
    await t.start()
    return t


async def test_start_sets_isolated_leverage_and_notifies(trader, fake, notifier):
    assert (BTC, 3, "isolated", "net_mode") in fake.leverage_calls
    assert (ETH, 3, "isolated", "net_mode") in fake.leverage_calls
    assert trader.ready
    assert notifier.has("Бот запущен") and notifier.has("DEMO")


async def test_open_long_places_order_with_exchange_sl_tp(trader, fake, storage, notifier):
    trade = await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    assert trade is not None
    order = fake.placed_orders[-1]
    expected = calculate_position_size(equity=1000, available=1000, entry_price=60_000, stop_price=59_850,
                                       instrument=fake.instruments[BTC], risk_pct=1, leverage=3,
                                       fee_rate=0.0005, max_margin_usage_pct=90)
    assert order["side"] == "buy" and order["td_mode"] == "isolated"
    assert float(order["sz"]) == pytest.approx(expected.contracts)
    # SL/TP прикреплены к ордеру: появляются на бирже вместе с позицией
    assert order["sl"] == "59850.0" and order["tp"] == "60300.0"
    algos = await fake.get_pending_tpsl(BTC)
    assert len(algos) == 1 and algos[0].sl_trigger == 59_850 and algos[0].tp_trigger == 60_300
    assert trade.algo_id == algos[0].algo_id
    # сделка сохранена в SQLite
    saved = storage.open_trades()
    assert len(saved) == 1 and saved[0].inst_id == BTC and saved[0].stop_loss == 59_850
    assert notifier.has("LONG BTC-USDT-SWAP")


async def test_open_short(trader, fake):
    trade = await trader._open_position(ETH, make_signal("short", 3_000, atr=10))
    assert fake.placed_orders[-1]["side"] == "sell"
    assert trade.side == "short"
    assert trade.stop_loss == pytest.approx(3_015) and trade.take_profit == pytest.approx(2_970)
    assert fake.positions[ETH]["side"] == "short"


async def test_sl_tp_aligned_to_actual_fill_price(trader, fake):
    """Цена ушла между сигналом и исполнением — SL/TP пересчитываются от фактического входа."""
    fake.set_price(BTC, 60_050)
    trade = await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    assert trade.entry_price == 60_050
    assert trade.stop_loss == pytest.approx(59_900) and trade.take_profit == pytest.approx(60_350)
    algo = fake.algos[trade.algo_id]
    assert algo.sl_trigger == pytest.approx(59_900) and algo.tp_trigger == pytest.approx(60_350)


async def test_attached_algo_missing_places_separate_tpsl(trader, fake):
    fake.attach_algos = False
    trade = await trader._open_position(BTC, make_signal("long"))
    assert len(fake.placed_algos) == 1
    assert fake.placed_algos[0]["close_side"] == "sell"
    assert trade.algo_id in fake.algos


async def test_position_closed_if_protection_impossible(trader, fake, storage, notifier):
    fake.attach_algos = False
    fake.fail_tpsl = True
    await trader._open_position(BTC, make_signal("long"))
    assert BTC not in fake.positions
    assert BTC not in trader.trades
    closed = storage.closed_trades()
    assert len(closed) == 1 and closed[0].close_reason == "no_protection"
    assert notifier.has("не удалось выставить SL/TP")


async def test_insufficient_margin_retries_with_smaller_size(trader, fake, notifier):
    fake.insufficient_funds = 1
    trade = await trader._open_position(BTC, make_signal("long"))
    assert trade is not None
    assert len(fake.placed_orders) == 2
    first, second = (float(o["sz"]) for o in fake.placed_orders)
    assert second == pytest.approx(round(first * 0.6 - 0.005, 2))  # 60% объёма, вниз до лота
    assert trade.contracts == second


async def test_insufficient_margin_twice_skips(trader, fake, notifier):
    fake.insufficient_funds = 2
    assert await trader._open_position(BTC, make_signal("long")) is None
    assert not fake.positions
    assert notifier.has("недостаточно маржи")


async def test_too_small_for_min_contract_skips(settings, storage, notifier, clock):
    from conftest import FakeOkx
    fake = FakeOkx(cash=1.0)  # риск 0.01 USDT — меньше одного минимального контракта
    t = make_trader(settings, fake, storage, notifier, clock)
    await t.start()
    assert await t._open_position(BTC, make_signal("long")) is None
    assert not fake.placed_orders
    assert notifier.has("минимального")


async def test_no_duplicate_when_position_already_on_exchange(trader, fake):
    fake.open_manual(BTC, "long", 1.0, 60_000)
    await trader.handle_signal(BTC, make_signal("long"))
    assert not fake.placed_orders


async def test_no_second_entry_on_same_symbol(trader, fake):
    await trader.handle_signal(BTC, make_signal("long"))
    await trader.handle_signal(BTC, make_signal("long"))
    await trader.handle_signal(BTC, make_signal("short"))
    assert len(fake.placed_orders) == 1


async def test_max_open_positions(fake, storage, notifier, clock):
    s = Settings(database_path=":memory:", risk=RiskConfig(max_open_positions=1))
    t = make_trader(s, fake, storage, notifier, clock)
    await t.start()
    await t.handle_signal(BTC, make_signal("long"))
    await t.handle_signal(ETH, make_signal("long", 3_000, atr=10))
    assert len(fake.placed_orders) == 1
    assert notifier.has("максимум позиций")


async def test_pause_and_resume(trader, fake, notifier):
    trader.set_paused(True)
    await trader.handle_signal(BTC, make_signal("long"))
    assert not fake.placed_orders and notifier.has("пауз")
    trader.set_paused(False)
    await trader.handle_signal(BTC, make_signal("long"))
    assert len(fake.placed_orders) == 1


async def test_trailing_stop(trader, fake, storage, notifier):
    trade = await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    assert trade.stop_loss == 59_850
    # +0.5 ATR — трейлинг ещё не активен
    await trader._update_trailing(trade, 60_050, 60_050, 60_000)
    assert not trade.trailing_active and not fake.amends
    # +1 ATR — активация, стоп в безубыток (лучшая цена − 1 ATR)
    await trader._update_trailing(trade, 60_090, 60_100, 60_040)
    assert trade.trailing_active
    assert trade.stop_loss == pytest.approx(60_000)
    assert fake.algos[trade.algo_id].sl_trigger == pytest.approx(60_000)
    assert notifier.has("трейлинг включён")
    # дальше: стоп тянется за ценой
    await trader._update_trailing(trade, 60_200, 60_250, 60_150)
    assert trade.stop_loss == pytest.approx(60_150)
    # мелкое улучшение (< 0.1 ATR) не двигает стоп — экономим запросы
    n = len(fake.amends)
    await trader._update_trailing(trade, 60_250, 60_255, 60_240)
    assert len(fake.amends) == n
    # откат цены не опускает стоп
    await trader._update_trailing(trade, 60_160, 60_170, 60_155)
    assert trade.stop_loss == pytest.approx(60_150)
    assert storage.get_trade(trade.id).stop_loss == pytest.approx(60_150)
    assert storage.get_trade(trade.id).trailing_active


async def test_trailing_short(trader, fake):
    trade = await trader._open_position(ETH, make_signal("short", 3_000, atr=10))
    await trader._update_trailing(trade, 2_992, 2_995, 2_990)
    assert trade.trailing_active and trade.stop_loss == pytest.approx(3_000)
    await trader._update_trailing(trade, 2_980, 2_985, 2_975)
    assert trade.stop_loss == pytest.approx(2_985)


async def test_trailing_falls_back_to_replacing_order(trader, fake):
    trade = await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    old_algo = trade.algo_id
    fake.fail_amend = True
    await trader._update_trailing(trade, 60_090, 60_100, 60_050)
    assert trade.stop_loss == pytest.approx(60_000)
    assert old_algo not in fake.algos and trade.algo_id in fake.algos
    new = fake.algos[trade.algo_id]
    assert new.sl_trigger == pytest.approx(60_000) and new.tp_trigger == pytest.approx(60_300)


async def test_exchange_take_profit_is_recorded(trader, fake, storage, notifier):
    trade = await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    fake.set_price(BTC, 60_320)
    assert fake.trigger(BTC) == "tp"
    await trader.reconcile()
    assert BTC not in trader.trades
    closed = storage.get_trade(trade.id)
    assert closed.status == "closed" and closed.close_reason == "take_profit"
    assert closed.exit_price == pytest.approx(60_300)
    assert closed.pnl == pytest.approx(300 * trade.qty - 60_300 * trade.qty * 0.0005)
    assert notifier.has("Закрыта LONG BTC-USDT-SWAP") and notifier.has("тейк-профит")


async def test_exchange_stop_loss_and_trailing_stop_reasons(trader, fake, storage):
    t1 = await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    fake.set_price(BTC, 59_800)
    fake.trigger(BTC)
    await trader.reconcile()
    assert storage.get_trade(t1.id).close_reason == "stop_loss"
    assert storage.get_trade(t1.id).pnl < 0

    t2 = await trader._open_position(ETH, make_signal("short", 3_000, atr=10))
    await trader._update_trailing(t2, 2_985, 2_985, 2_980)  # стоп → 2990
    fake.set_price(ETH, 2_991)
    fake.trigger(ETH)
    await trader.reconcile()
    t2s = storage.get_trade(t2.id)
    assert t2s.close_reason == "trailing_stop" and t2s.pnl > 0


async def test_missing_sl_is_restored_by_reconcile(trader, fake, notifier):
    trade = await trader._open_position(BTC, make_signal("long"))
    fake.algos.clear()  # кто-то отменил SL/TP на бирже
    await trader.reconcile()
    algos = await fake.get_pending_tpsl(BTC)
    assert len(algos) == 1 and algos[0].sl_trigger == trade.stop_loss
    assert notifier.has("выставлены заново")


async def test_missing_sl_with_price_beyond_stop_closes(trader, fake, storage):
    trade = await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    fake.algos.clear()
    fake.set_price(BTC, 59_700)
    await trader.reconcile()
    assert BTC not in fake.positions
    assert storage.get_trade(trade.id).close_reason == "stop_loss_missing"


async def test_daily_loss_limit(trader, fake, storage, notifier, clock):
    assert storage.get_state("day_start_equity") == pytest.approx(1000)
    fake.equity_override = 949.0  # −5.1%
    await trader.reconcile()
    assert trader.daily_limit_hit
    assert notifier.has("Дневной лимит убытка достигнут")
    count = sum("Дневной лимит" in m for m in notifier.messages)
    await trader.reconcile()
    assert sum("Дневной лимит" in m for m in notifier.messages) == count  # уведомление один раз
    await trader.handle_signal(BTC, make_signal("long"))
    assert not fake.placed_orders
    # лимит переживает перезапуск
    t2 = make_trader(trader.s, fake, storage, notifier, clock)
    await t2.start()
    assert t2.daily_limit_hit
    # на следующий день — снова торгуем
    fake.equity_override = None
    clock.advance(86_400)
    await t2.tick()
    assert not t2.daily_limit_hit
    assert notifier.has("Итоги")
    await t2.handle_signal(BTC, make_signal("long"))
    assert len(fake.placed_orders) == 1


async def test_restart_resumes_tracked_trade_without_duplicates(trader, fake, storage, notifier, clock, settings):
    trade = await trader._open_position(BTC, make_signal("long"))
    algos_before = dict(fake.algos)
    t2 = make_trader(settings, fake, storage, notifier, clock)
    await t2.start()
    assert t2.trades[BTC].id == trade.id
    assert fake.algos == algos_before  # ничего не перевыставлено
    assert len(storage.open_trades()) == 1
    assert not notifier.has("Найдена открытая позиция")
    await t2.handle_signal(BTC, make_signal("long"))
    assert len(fake.placed_orders) == 1


async def test_restart_adopts_unknown_position_and_protects_it(settings, fake, storage, notifier, clock):
    fake.open_manual(BTC, "long", 0.5, 60_000)
    fake.candles[BTC] = __import__("conftest").wave_candles(start=50_000)
    t = make_trader(settings, fake, storage, notifier, clock)
    await t.start()
    trade = t.trades[BTC]
    assert trade.note.startswith("adopted") and trade.contracts == 0.5
    assert trade.stop_loss < 60_000 < trade.take_profit
    algos = await fake.get_pending_tpsl(BTC)
    assert len(algos) == 1 and algos[0].sl_trigger == trade.stop_loss
    assert notifier.has("Найдена открытая позиция")


async def test_restart_adopts_position_with_existing_sl(settings, fake, storage, notifier, clock):
    fake.open_manual(ETH, "short", 2.0, 3_000)
    await fake.place_tpsl(inst_id=ETH, close_side="buy", pos_side="net", td_mode="isolated", sz="2",
                          sl_trigger="3050", tp_trigger="2900", algo_cl_id="manual1")
    fake.candles[ETH] = __import__("conftest").wave_candles(start=3_000)
    t = make_trader(settings, fake, storage, notifier, clock)
    await t.start()
    trade = t.trades[ETH]
    assert trade.stop_loss == 3_050 and trade.take_profit == 2_900
    assert len(fake.algos) == 1  # существующий SL использован, новый не выставлялся


async def test_trade_closed_while_bot_was_offline(settings, fake, storage, notifier, clock):
    t = make_trader(settings, fake, storage, notifier, clock)
    await t.start()
    trade = await t._open_position(BTC, make_signal("long", 60_000, atr=100))
    fake.set_price(BTC, 59_800)
    fake.trigger(BTC)  # бот выключен, сработал SL на бирже
    t2 = make_trader(settings, fake, storage, notifier, clock)
    await t2.start()
    assert BTC not in t2.trades
    assert storage.get_trade(trade.id).close_reason == "stop_loss"


async def test_close_all(trader, fake, storage, notifier):
    await trader._open_position(BTC, make_signal("long"))
    await trader._open_position(ETH, make_signal("short", 3_000, atr=10))
    result = await trader.close_all()
    assert result.positions_closed == 2 and not result.remaining
    assert not fake.positions and not fake.algos
    assert trader.paused
    assert not trader.trades
    reasons = {t.close_reason for t in storage.closed_trades()}
    assert reasons == {"close_all"}
    assert notifier.has("Аварийное закрытие")
    await trader.handle_signal(BTC, make_signal("long"))
    assert len(fake.placed_orders) == 2  # после /closeall бот на паузе


async def test_close_on_opposite_signal(fake, storage, notifier, clock):
    s = Settings(database_path=":memory:", risk=RiskConfig(close_on_opposite_signal=True))
    t = make_trader(s, fake, storage, notifier, clock)
    await t.start()
    first = await t._open_position(BTC, make_signal("long"))
    await t.handle_signal(BTC, make_signal("short"))
    assert storage.get_trade(first.id).close_reason == "opposite_signal"
    assert t.trades[BTC].side == "short"


class StubStrategy:
    """Сигнал на каждом баре — чтобы проверить расписание по закрытию свечей."""

    name = "stub"
    min_candles = 1

    def __init__(self):
        self.calls = []

    def generate_signal(self, candles: Candles):
        self.calls.append(int(candles.ts[-1]))
        return None


async def test_signals_evaluated_once_per_closed_candle(settings, fake, storage, notifier, clock):
    tf = 900_000
    strat = StubStrategy()
    t = make_trader(settings, fake, storage, notifier, clock, strategy=strat)
    clock.t = T0 + 600  # 10 минут после открытия бара — сигнал прошлого бара уже устарел
    await t.start()

    def set_candles(last_closed_ms):
        rows = [[last_closed_ms - k * tf, 1, 2, 0.5, 1.5, 1] for k in range(5)]
        for inst in (BTC, ETH):
            fake.candles[inst] = Candles.from_rows(rows)

    await t.tick()
    assert strat.calls == []  # ничего нового не закрылось
    clock.t = T0 + 900 + 1  # бар закрылся, но задержка 3с ещё не прошла
    await t.tick()
    assert strat.calls == []
    clock.t = T0 + 900 + 4
    set_candles(int(T0 * 1000))
    await t.tick()
    assert strat.calls == [int(T0 * 1000)] * 2
    await t.tick()
    assert len(strat.calls) == 2  # повторно тот же бар не обрабатывается


async def test_candle_not_yet_available_is_retried(settings, fake, storage, notifier, clock):
    tf = 900_000
    strat = StubStrategy()
    t = make_trader(settings, fake, storage, notifier, clock, strategy=strat)
    clock.t = T0 + 600
    await t.start()
    stale = Candles.from_rows([[int(T0 * 1000) - tf, 1, 2, 0.5, 1.5, 1]])
    fake.candles = {BTC: stale, ETH: stale}
    clock.t = T0 + 905
    await t.tick()
    assert strat.calls == []  # биржа ещё не отдала закрытую свечу
    fresh = Candles.from_rows([[int(T0 * 1000) - tf, 1, 2, 0.5, 1.5, 1], [int(T0 * 1000), 1, 2, 0.5, 1.5, 1]])
    fake.candles = {BTC: fresh, ETH: fresh}
    clock.t = T0 + 910
    await t.tick()
    assert strat.calls == [int(T0 * 1000)] * 2


async def test_run_survives_errors_and_startup_failures(settings, fake, storage, notifier, clock, monkeypatch):
    calls = {"n": 0}
    original = fake.load_instruments

    async def flaky(inst_ids):
        calls["n"] += 1
        if calls["n"] < 3:
            raise RequestTimeout("okx timeout")
        return await original(inst_ids)

    fake.load_instruments = flaky
    t = make_trader(settings, fake, storage, notifier, clock)
    monkeypatch.setattr("bot.trader.backoff_delay", lambda *a, **k: 0)
    ticks = {"n": 0}

    async def boom():
        ticks["n"] += 1
        if ticks["n"] == 1:
            raise RuntimeError("неожиданная ошибка")
        t.stop()

    t.tick = boom
    t.s = t.s.model_copy(update={"trading": t.s.trading.model_copy(update={"loop_interval_sec": 0.01})})
    monkeypatch.setattr("bot.trader.asyncio.sleep", _fast_sleep)
    t._sleep = _fast_sleep  # noqa: SLF001
    await t.run()
    assert calls["n"] == 3 and t.ready
    assert ticks["n"] == 2
    assert notifier.has("Не удаётся запуститься") and notifier.has("неожиданная ошибка")


async def _fast_sleep(*_args, **_kwargs):
    return None


async def test_report_and_status(trader, fake, storage):
    await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    view = await trader.status_view()
    assert view.mode == "DEMO" and len(view.positions) == 1 and view.positions[0].managed
    fake.set_price(BTC, 60_400)
    fake.trigger(BTC)
    await trader.reconcile()
    text = trader.report_text()
    assert "Сделок: 1" in text and "Винрейт: 100.0%" in text
    assert isinstance(storage.closed_trades()[0], Trade)


async def test_tp_fired_between_snapshots_is_not_mistaken_for_missing_protection(trader, fake, storage):
    """Позиции и ордера читаются разными запросами: если TP сработал между ними, бот не должен
    ни выставлять новый SL/TP, ни закрывать позицию сам."""
    trade = await trader._open_position(BTC, make_signal("long", 60_000, atr=100))
    [stale_position] = await fake.get_positions()
    fake.set_price(BTC, 60_310)
    fake.trigger(BTC)  # биржа закрыла позицию по тейку
    await trader._ensure_protection(trade, stale_position, algos=[])
    assert not fake.placed_algos and not fake.closed_calls
    await trader.reconcile()
    assert storage.get_trade(trade.id).close_reason == "take_profit"
