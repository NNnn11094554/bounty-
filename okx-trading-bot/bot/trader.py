"""Торговое ядро: сигналы на закрытии свечи, вход с SL/TP на бирже, трейлинг,
сверка с биржей, дневной лимит, аварийное закрытие."""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo

from ccxt.base.errors import AuthenticationError, ExchangeError, InsufficientFunds, InvalidOrder, NetworkError

from . import messages
from .config import Settings
from .exchange import CLIENT_ID_PREFIX, backoff_delay, new_client_id
from .models import AlgoOrder, Balance, InstrumentInfo, OrderInfo, Position, Trade
from .notifier import Notifier
from .risk import RiskManager, calculate_position_size, stop_beyond_liquidation
from .stats import trade_stats
from .strategies.base import Signal, Strategy
from .trailing import trail_step
from .ws_prices import PriceFeed

log = logging.getLogger("bot.trader")

# сколько ждать появления закрытой позиции в истории OKX, прежде чем оценить PnL по текущей цене
HISTORY_WAIT_MS = 120_000


def _err(exc: BaseException, limit: int = 300) -> str:
    """Текст исключения для HTML-сообщения Telegram (биржа может вернуть HTML-страницу ошибки)."""
    return escape(str(exc)[:limit])


class FatalConfigError(RuntimeError):
    """Ошибка, которую бот не исправит сам (например, режим аккаунта без свопов)."""


@dataclass
class CloseAllResult:
    positions_closed: int = 0
    algos_canceled: int = 0
    orders_canceled: int = 0
    remaining: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class Trader:
    poll_delay = 0.5  # пауза при ожидании исполнения ордера / появления SL/TP

    def __init__(
        self,
        settings: Settings,
        client,
        storage,
        strategy: Strategy,
        notifier: Notifier,
        price_feed: PriceFeed | None = None,
        clock: Callable[[], float] = time.time,
        heartbeat_path: str | None = None,
    ):
        self.s = settings
        self.client = client
        self.storage = storage
        self.strategy = strategy
        self.notifier = notifier
        self.price_feed = price_feed
        self.clock = clock
        self.heartbeat_path = Path(heartbeat_path) if heartbeat_path else None
        self.risk = RiskManager(settings.risk)
        self.symbols = settings.exchange.symbols
        self.tf_ms = settings.exchange.timeframe_ms
        self.tz = ZoneInfo(settings.risk.day_reset_timezone)
        self.instruments: dict[str, InstrumentInfo] = {}
        self.leverage: dict[str, int] = {}
        self.pos_mode = "net_mode"
        self.trades: dict[str, Trade] = {}
        self.last_bar: dict[str, int] = {}
        self.balance: Balance | None = None
        self.ready = False
        self.last_heartbeat = time.monotonic()
        self._lock = asyncio.Lock()
        self._stop = asyncio.Event()
        self._last_reconcile = 0.0
        self._warned: set[str] = set()

    # ================= состояние =================

    @property
    def mode(self) -> str:
        return self.s.mode

    @property
    def paused(self) -> bool:
        return bool(self.storage.get_state("paused", False))

    def set_paused(self, value: bool) -> None:
        self.storage.set_state("paused", bool(value))

    def now_ms(self) -> int:
        return int(self.clock() * 1000)

    def day_key(self, ts: float | None = None) -> str:
        return datetime.fromtimestamp(self.clock() if ts is None else ts, self.tz).date().isoformat()

    def day_bounds_ms(self, key: str) -> tuple[int, int]:
        d = date.fromisoformat(key)
        start = datetime(d.year, d.month, d.day, tzinfo=self.tz)
        return int(start.timestamp() * 1000), int((start + timedelta(days=1)).timestamp() * 1000)

    @property
    def daily_limit_hit(self) -> bool:
        return self.storage.get_state("daily_limit_day") == self.day_key()

    @property
    def state_label(self) -> str:
        if not self.ready:
            return "запускается"
        if self.daily_limit_hit:
            return "⛔ дневной лимит убытка, новые сделки завтра"
        if self.paused:
            return "⏸ пауза (сопровождаю открытые позиции)"
        return "▶️ работает"

    def _lev(self, inst_id: str) -> int:
        return self.leverage.get(inst_id, self.s.exchange.leverage)

    async def _sleep(self, seconds: float) -> None:
        if seconds <= 0:
            return
        try:
            await asyncio.wait_for(self._stop.wait(), timeout=seconds)
        except TimeoutError:
            pass

    async def price(self, inst_id: str) -> float:
        if self.price_feed is not None:
            return await self.price_feed.get_price(inst_id)
        return await self.client.fetch_ticker_price(inst_id)

    def _reset_price_range(self, inst_id: str) -> None:
        """Экстремумы цены копятся в PriceFeed и без позиции — для новой сделки считаем их заново."""
        if self.price_feed is not None:
            self.price_feed.reset_range(inst_id)

    async def _position_exists(self, trade: Trade) -> bool:
        return any(p.inst_id == trade.inst_id and p.side == trade.side for p in await self.client.get_positions())

    async def _price_range(self, inst_id: str) -> tuple[float, float, float]:
        if self.price_feed is not None:
            return await self.price_feed.take_range(inst_id)
        p = await self.client.fetch_ticker_price(inst_id)
        return p, p, p

    # ================= запуск и основной цикл =================

    async def prepare(self) -> None:
        """Инструменты, режим аккаунта и открытые сделки из БД — общее для запуска и консольного closeall."""
        open_trades = self.storage.open_trades()
        self.instruments = await self.client.load_instruments(self.symbols)
        for inst_id in dict.fromkeys(t.inst_id for t in open_trades if t.inst_id not in self.instruments):
            try:  # инструмент убрали из config.yaml, а позиция по нему ещё открыта — сопровождаем до закрытия
                self.instruments.update(await self.client.load_instruments([inst_id]))
                log.warning("%s нет в config.yaml, но по нему открыта сделка — сопровождаю её до закрытия", inst_id)
            except ValueError as exc:
                log.error("%s: %s", inst_id, exc)
        account = await self.client.get_account_config()
        if account.acct_lv == "1":
            raise FatalConfigError(
                "Аккаунт OKX в режиме Spot: бессрочные свопы недоступны. Переключите режим аккаунта "
                "(Settings → Account mode) на Futures / Single-currency margin.")
        self.pos_mode = account.pos_mode
        self.trades = {}
        for t in open_trades:  # по возрастанию id
            old = self.trades.get(t.inst_id)
            if old is not None:  # две записи об одной позиции (например, её взяли на сопровождение дважды)
                log.warning("В БД две открытые сделки по %s: #%s помечена как дубль #%s", t.inst_id, old.id, t.id)
                old.status, old.note = "merged", f"{old.note}; дубль сделки #{t.id}"[:500]
                self.storage.update_trade(old, "status", "note")
            self.trades[t.inst_id] = t
            self._reset_price_range(t.inst_id)

    async def start(self) -> None:
        await self.prepare()
        for inst_id in self.symbols:
            info = self.instruments[inst_id]
            lever = int(min(self.s.exchange.leverage, info.max_lever))
            self.leverage[inst_id] = lever
            try:
                await self.client.set_leverage(inst_id, lever, self.s.exchange.margin_mode, self.pos_mode)
            except ExchangeError as exc:
                log.warning("Не удалось установить плечо %sx для %s: %s", lever, inst_id, exc)
                await self.notifier.error(f"lever-{inst_id}", f"⚠️ Не удалось установить плечо {lever}x для "
                                                               f"{inst_id}: {_err(exc)}")
        await self._roll_day()
        async with self._lock:
            await self._reconcile()
        self._last_reconcile = self.clock()
        now = self.now_ms()
        cur_start = now // self.tf_ms * self.tf_ms
        for inst_id in self.symbols:
            last_closed = cur_start - self.tf_ms
            # сигнал свечи, закрывшейся только что (бот перезапустился) ещё актуален
            fresh = now - cur_start <= self.s.trading.signal_max_delay_sec * 1000
            self.last_bar[inst_id] = last_closed - self.tf_ms if fresh else last_closed
        self.ready = True
        managed = ", ".join(f"{messages.side_label(t.side)} {t.inst_id}" for t in self.trades.values()) or "нет"
        await self.notifier.notify(
            f"🚀 <b>Бот запущен</b> [{self.mode}] — {self.state_label}\n"
            f"Стратегия: {self.strategy.name}, {', '.join(self.symbols)}, {self.s.exchange.timeframe}, "
            f"{self.s.exchange.leverage}x {self.s.exchange.margin_mode}\n"
            f"Сопровождаю позиции: {managed}")

    async def run(self) -> None:
        attempt = 0
        while not self._stop.is_set():
            try:
                await self.start()
                break
            except FatalConfigError as exc:
                log.critical("%s", exc)
                await self.notifier.notify(f"🛑 {exc}")
                raise
            except Exception as exc:  # noqa: BLE001 — нет сети/биржа недоступна: пробуем дальше
                attempt += 1
                delay = backoff_delay(attempt, base=5, cap=120)
                hint = " Проверьте API-ключи и режим DEMO/LIVE." if isinstance(exc, AuthenticationError) else ""
                log.error("Запуск не удался (%s: %s), повтор через %.0fс", type(exc).__name__, exc, delay)
                await self.notifier.error("startup", f"⚠️ Не удаётся запуститься: {type(exc).__name__}: "
                                                     f"{_err(exc)}.{hint} Повторяю попытки.")
                self.touch_heartbeat()
                await self._sleep(delay)
        errors = 0
        while not self._stop.is_set():
            try:
                await self.tick()
                errors = 0
            except Exception as exc:  # noqa: BLE001 — цикл не должен умирать
                errors += 1
                log.exception("Ошибка в торговом цикле")
                await self.notifier.error(f"loop-{type(exc).__name__}",
                                          f"⚠️ Ошибка: {type(exc).__name__}: {_err(exc)}")
                await self._sleep(min(60.0, 2.0 ** errors))
            self.touch_heartbeat()
            await self._sleep(self.s.trading.loop_interval_sec)

    def touch_heartbeat(self) -> None:
        self.last_heartbeat = time.monotonic()
        if self.heartbeat_path:
            try:
                self.heartbeat_path.parent.mkdir(parents=True, exist_ok=True)
                self.heartbeat_path.write_text(str(int(time.time())))
            except OSError as exc:
                log.warning("heartbeat: %s", exc)

    def stop(self) -> None:
        self._stop.set()

    async def tick(self) -> None:
        await self._roll_day()
        if self.clock() - self._last_reconcile >= self.s.trading.reconcile_interval_sec:
            async with self._lock:
                await self._reconcile()
            self._last_reconcile = self.clock()
        if self.trades:
            async with self._lock:
                await self._manage_positions()
        now = self.now_ms()
        for inst_id in self.symbols:
            if self._bar_due(inst_id, now):
                await self.on_bar_close(inst_id)

    # ================= день и дневной лимит =================

    async def _roll_day(self) -> None:
        key = self.day_key()
        prev = self.storage.get_state("day_key")
        if prev == key:
            return
        balance = await self.client.get_balance()
        self.balance = balance
        prev_start_equity = self.storage.get_state("day_start_equity")
        self.storage.set_state("day_key", key)
        self.storage.set_state("day_start_equity", balance.equity)
        log.info("Новый торговый день %s, equity на начало: %.2f USDT", key, balance.equity)
        if prev:
            start_ms, end_ms = self.day_bounds_ms(prev)
            closed = self.storage.closed_trades(start_ms, end_ms)
            pnl = sum(t.pnl or 0 for t in closed)
            change = ""
            if prev_start_equity:
                diff = balance.equity - prev_start_equity
                change = f", equity {messages.money(diff, signed=True)} ({diff / prev_start_equity * 100:+.2f}%)"
            await self.notifier.notify(
                f"📅 <b>Итоги {prev}</b> [{self.mode}]: сделок {len(closed)}, "
                f"PnL {messages.money(pnl, signed=True)} USDT{change}\n"
                f"Баланс: {messages.money(balance.equity)} USDT. Дневной лимит сброшен.")

    async def _check_daily_limit(self, balance: Balance) -> bool:
        if self.daily_limit_hit:
            return True
        start = self.storage.get_state("day_start_equity")
        if start and self.risk.daily_limit_reached(start, balance.equity):
            self.storage.set_state("daily_limit_day", self.day_key())
            pct = self.risk.daily_pnl_pct(start, balance.equity)
            log.warning("Дневной лимит убытка: %.2f%%", pct)
            await self.notifier.notify(
                f"⛔ <b>Дневной лимит убытка достигнут</b> [{self.mode}]: {pct:.2f}% "
                f"(лимит −{self.s.risk.daily_loss_limit_pct:g}%).\n"
                f"Новые сделки не открываются до следующего дня ({self.s.risk.day_reset_timezone}). "
                f"Открытые позиции сопровождаются со своими SL/TP.")
            return True
        return False

    # ================= свечи и сигналы =================

    def _bar_due(self, inst_id: str, now_ms: int) -> bool:
        cur_start = now_ms // self.tf_ms * self.tf_ms
        last_closed = cur_start - self.tf_ms
        return (self.last_bar.get(inst_id, 0) < last_closed
                and now_ms >= cur_start + self.s.trading.candle_close_delay_sec * 1000)

    async def on_bar_close(self, inst_id: str) -> None:
        now = self.now_ms()
        cur_start = now // self.tf_ms * self.tf_ms
        expected = cur_start - self.tf_ms
        candles = await self.client.fetch_candles(inst_id, self.s.exchange.timeframe,
                                                  limit=self.s.exchange.candles_history)
        if len(candles) == 0 or int(candles.ts[-1]) < expected:
            if now - cur_start > self.s.trading.signal_max_delay_sec * 1000:
                log.warning("%s: закрытая свеча %s так и не пришла, пропускаю", inst_id, expected)
                self.last_bar[inst_id] = expected
            return
        self.last_bar[inst_id] = expected
        if int(candles.ts[-1]) > expected:  # на всякий случай: только до ожидаемой свечи
            n = int((candles.ts <= expected).sum())
            candles = candles.slice(0, n)
        signal = self.strategy.generate_signal(candles)
        if signal is None:
            log.debug("%s: сигнала нет", inst_id)
            return
        log.info("Сигнал %s %s: %s", messages.side_label(signal.side), inst_id, signal.reason)
        await self.handle_signal(inst_id, signal)

    async def handle_signal(self, inst_id: str, signal: Signal) -> None:
        async with self._lock:
            trade = self.trades.get(inst_id)
            if trade is not None:
                if trade.side != signal.side and self.s.risk.close_on_opposite_signal:
                    await self._close_trade_market(trade, "opposite_signal")
                    if inst_id in self.trades:
                        log.info("%s: позиция ещё не сверена после закрытия, новый вход пропущен", inst_id)
                        return
                else:
                    log.info("Сигнал по %s пропущен: позиция уже открыта", inst_id)
                    return
            await self._open_position(inst_id, signal)

    # ================= открытие позиции =================

    async def _open_position(self, inst_id: str, signal: Signal) -> Trade | None:
        label = f"{messages.side_label(signal.side)} {inst_id}"
        positions = await self.client.get_positions()
        on_exchange = {p.inst_id for p in positions if p.inst_id in self.symbols}
        if inst_id in on_exchange:
            log.info("Сигнал %s пропущен: позиция уже есть на бирже (будет взята на сопровождение)", label)
            return None
        decision = self.risk.check_entry(inst_id=inst_id, open_inst_ids=on_exchange | set(self.trades),
                                         paused=self.paused, daily_limit_hit=self.daily_limit_hit)
        if not decision.allowed:
            log.info("Сигнал %s пропущен: %s", label, decision.reason)
            await self.notifier.notify(f"ℹ️ Сигнал {label} пропущен: {decision.reason}")
            return None
        balance = await self.client.get_balance()
        self.balance = balance
        if await self._check_daily_limit(balance):
            return None

        info = self.instruments[inst_id]
        lever = self._lev(inst_id)
        sign = 1 if signal.side == "long" else -1
        price = await self.price(inst_id)
        sl_dist, tp_dist = signal.stop_distance, signal.take_distance
        sl = info.round_price(price - sign * sl_dist)
        tp = info.round_price(price + sign * tp_dist) if tp_dist else None
        if stop_beyond_liquidation(price, sl, lever):
            msg = f"стоп {sl_dist / price:.1%} слишком далеко для плеча {lever}x (ближе ликвидация)"
            log.warning("Сигнал %s пропущен: %s", label, msg)
            await self.notifier.notify(f"⚠️ Сигнал {label} пропущен: {msg}")
            return None

        risk_cfg = self.s.risk
        pos_side = "net" if self.pos_mode == "net_mode" else signal.side
        order_side = "buy" if signal.side == "long" else "sell"
        ord_id = algo_cl = None
        risk_amount = 0.0
        size_factor = 1.0
        for attempt in (1, 2):
            sizing = calculate_position_size(
                equity=balance.equity, available=balance.available, entry_price=price, stop_price=sl,
                instrument=info, risk_pct=risk_cfg.risk_per_trade_pct, leverage=lever,
                fee_rate=risk_cfg.taker_fee_pct / 100, max_margin_usage_pct=risk_cfg.max_margin_usage_pct)
            contracts = info.round_size_down(sizing.contracts * size_factor)
            if not sizing.ok or contracts < info.min_size:
                reason = sizing.reason or "после уменьшения объём меньше минимального контракта"
                log.warning("Сигнал %s пропущен: %s", label, reason)
                await self.notifier.notify(f"⚠️ Сигнал {label} пропущен: {reason}")
                return None
            risk_amount = sizing.risk_amount * contracts / sizing.contracts
            if sizing.capped_by_margin:
                log.info("%s: объём урезан по доступной марже (риск %.2f вместо %.2f USDT)",
                         label, sizing.risk_amount, sizing.target_risk)
            cl_id, algo_cl = new_client_id("e"), new_client_id("a")
            try:
                ord_id = await self.client.place_market_order(
                    inst_id=inst_id, side=order_side, sz=info.fmt_size(contracts),
                    td_mode=self.s.exchange.margin_mode, pos_side=pos_side, cl_ord_id=cl_id,
                    sl_trigger=info.fmt_price(sl), tp_trigger=info.fmt_price(tp) if tp else None,
                    attach_algo_cl_id=algo_cl, trigger_px_type=self.s.exchange.trigger_price_type)
                break
            except InsufficientFunds as exc:
                log.warning("%s: недостаточно маржи (%s), попытка %d", label, exc, attempt)
                if attempt == 2:
                    await self.notifier.notify(f"❌ {label}: недостаточно маржи для входа, сделка пропущена.")
                    return None
                balance = await self.client.get_balance()
                size_factor = 0.6  # биржа считает маржу строже (комиссии, лимиты) — повтор с меньшим объёмом
            except InvalidOrder as exc:
                log.error("%s: биржа отклонила ордер: %s", label, exc)
                await self.notifier.notify(f"❌ {label}: биржа отклонила ордер: {_err(exc)}")
                return None
        assert ord_id is not None and algo_cl is not None

        order = await self._wait_fill(inst_id, ord_id)
        if order is None or order.filled_sz <= 0:
            log.error("%s: ордер %s не исполнен (%s)", label, ord_id, order)
            await self.notifier.notify(f"❌ {label}: рыночный ордер не исполнился.")
            return None
        entry = order.avg_px or price
        trade = Trade(
            inst_id=inst_id, side=signal.side, pos_side=pos_side, contracts=order.filled_sz,
            entry_price=entry, stop_loss=info.round_price(entry - sign * sl_dist),
            take_profit=info.round_price(entry + sign * tp_dist) if tp_dist else None,
            initial_stop=info.round_price(entry - sign * sl_dist), atr=signal.levels.atr,
            trail_activation=signal.levels.trail_activation, trail_distance=signal.levels.trail_distance,
            opened_at=self.now_ms(), ct_val=info.ct_val, mode=self.mode, strategy=self.strategy.name,
            best_price=entry, ord_id=ord_id, algo_cl_id=algo_cl, note=signal.reason[:500],
            mgn_mode=self.s.exchange.margin_mode)
        self.storage.insert_trade(trade)
        self.trades[inst_id] = trade
        self._reset_price_range(inst_id)
        log.info("Открыта %s: %s конт. @ %s, SL %s, TP %s", label, trade.contracts, entry,
                 trade.stop_loss, trade.take_profit)
        protected = await self._secure_new_trade(trade, attached_sl=sl, attached_tp=tp)
        if protected:
            await self.notifier.notify(messages.opened(
                trade, info, self.mode, lever, self.s.exchange.margin_mode, risk_amount,
                risk_amount / balance.equity * 100 if balance.equity else 0.0, signal.reason))
        return trade

    async def _wait_fill(self, inst_id: str, ord_id: str) -> OrderInfo | None:
        info = None
        for _ in range(10):
            info = await self.client.get_order(inst_id, ord_id=ord_id)
            if info and info.state in ("filled", "canceled", "mmp_canceled"):
                return info
            await asyncio.sleep(self.poll_delay)
        if info and info.state in ("live", "partially_filled"):
            await self.client.cancel_order(inst_id, ord_id)
            info = await self.client.get_order(inst_id, ord_id=ord_id)
        return info

    async def _secure_new_trade(self, trade: Trade, attached_sl: float, attached_tp: float | None) -> bool:
        """Убедиться, что SL/TP висят на бирже, и выровнять их по фактической цене входа."""
        info = self.instruments[trade.inst_id]
        algo: AlgoOrder | None = None
        for _ in range(6):
            algos = await self.client.get_pending_tpsl(trade.inst_id)
            algo = (next((a for a in algos if a.algo_cl_id == trade.algo_cl_id), None)
                    or next((a for a in algos if a.protects(trade.side)), None))
            if algo:
                break
            await asyncio.sleep(self.poll_delay)
        if algo is not None:
            trade.algo_id, trade.algo_cl_id = algo.algo_id, algo.algo_cl_id or trade.algo_cl_id
            half_tick = info.tick_size / 2
            sl_off = algo.sl_trigger is None or abs(algo.sl_trigger - trade.stop_loss) > half_tick
            tp_off = trade.take_profit is not None and (
                algo.tp_trigger is None or abs(algo.tp_trigger - trade.take_profit) > half_tick)
            if sl_off or tp_off:
                try:
                    await self.client.amend_tpsl(
                        inst_id=trade.inst_id, algo_id=algo.algo_id, sl_trigger=info.fmt_price(trade.stop_loss),
                        tp_trigger=info.fmt_price(trade.take_profit) if trade.take_profit else None,
                        trigger_px_type=self.s.exchange.trigger_price_type)
                except (ExchangeError, NetworkError) as exc:
                    # оставляем уровни, выставленные при входе (отличаются на проскальзывание)
                    log.warning("%s: не удалось выровнять SL/TP по цене входа: %s", trade.inst_id, exc)
                    trade.stop_loss = algo.sl_trigger or attached_sl
                    trade.initial_stop = trade.stop_loss
                    trade.take_profit = algo.tp_trigger or attached_tp
            self.storage.update_trade(trade, "algo_id", "algo_cl_id", "stop_loss", "initial_stop", "take_profit")
            return True
        log.warning("%s: прикреплённые SL/TP не найдены, выставляю отдельный ордер", trade.inst_id)
        try:
            await self._place_protection(trade)
            return True
        except Exception as exc:  # noqa: BLE001
            log.exception("%s: не удалось выставить SL/TP", trade.inst_id)
            await self.notifier.notify(f"🚨 {trade.inst_id}: не удалось выставить SL/TP ({_err(exc, 200)}). "
                                       f"Закрываю позицию по рынку.")
            await self._close_trade_market(trade, "no_protection")
            return False

    async def _place_protection(self, trade: Trade, sl_only: bool = False) -> str:
        info = self.instruments[trade.inst_id]
        algo_cl = new_client_id("s")
        algo_id = await self.client.place_tpsl(
            inst_id=trade.inst_id, close_side="sell" if trade.side == "long" else "buy",
            pos_side=trade.pos_side, td_mode=trade.mgn_mode, sz=info.fmt_size(trade.contracts),
            sl_trigger=info.fmt_price(trade.stop_loss),
            tp_trigger=info.fmt_price(trade.take_profit) if trade.take_profit and not sl_only else None,
            algo_cl_id=algo_cl, trigger_px_type=self.s.exchange.trigger_price_type)
        trade.algo_id, trade.algo_cl_id = algo_id, algo_cl
        self.storage.update_trade(trade, "algo_id", "algo_cl_id")
        log.info("%s: SL/TP выставлены отдельным ордером %s", trade.inst_id, algo_id)
        return algo_id

    # ================= сопровождение: трейлинг =================

    async def _manage_positions(self) -> None:
        for trade in list(self.trades.values()):
            if trade.inst_id not in self.instruments:
                continue
            try:
                last, high, low = await self._price_range(trade.inst_id)
            except NetworkError as exc:
                log.warning("%s: нет цены для трейлинга: %s", trade.inst_id, exc)
                continue
            await self._update_trailing(trade, last, high, low)

    async def _update_trailing(self, trade: Trade, last: float, high: float, low: float) -> None:
        info = self.instruments[trade.inst_id]
        step = trail_step(
            side=trade.side, entry=trade.entry_price, stop=trade.stop_loss, best=trade.best_price,
            active=trade.trailing_active, high=high, low=low, activation=trade.trail_activation,
            distance=trade.trail_distance, atr=trade.atr, tick=info.tick_size,
            min_step_atr=self.s.trading.trailing_min_step_atr, round_price=info.round_price)
        trade.best_price = step.best_price
        if not trade.algo_id:
            return
        if step.activated_now:
            trade.trailing_active = True
            self.storage.update_trade(trade, "trailing_active", "best_price")
            log.info("%s: трейлинг активирован (лучшая цена %s)", trade.inst_id, trade.best_price)
        if step.new_stop is None:
            return
        # стоп должен остаться по «правильную» сторону от текущей цены, иначе биржа отклонит перенос
        long = trade.side == "long"
        if (long and step.new_stop >= last - info.tick_size) or (not long and step.new_stop <= last + info.tick_size):
            return
        first_move = abs(trade.stop_loss - trade.initial_stop) < info.tick_size / 2
        await self._move_stop(trade, step.new_stop, announce=first_move)

    async def _move_stop(self, trade: Trade, new_sl: float, announce: bool = False) -> bool:
        info = self.instruments[trade.inst_id]
        old = trade.stop_loss
        try:
            await self.client.amend_tpsl(inst_id=trade.inst_id, algo_id=trade.algo_id,
                                         sl_trigger=info.fmt_price(new_sl),
                                         trigger_px_type=self.s.exchange.trigger_price_type)
        except NetworkError as exc:
            log.warning("%s: перенос стопа не удался (сеть): %s — повторю", trade.inst_id, exc)
            return False
        except ExchangeError as exc:
            log.warning("%s: amend SL не прошёл (%s) — заменяю TP/SL ордер", trade.inst_id, exc)
            old_algo = trade.algo_id
            prev_sl = trade.stop_loss
            trade.stop_loss = new_sl
            try:
                await self._place_protection(trade)
            except Exception as exc2:  # noqa: BLE001
                trade.stop_loss, trade.algo_id = prev_sl, old_algo
                log.error("%s: не удалось заменить TP/SL: %s", trade.inst_id, exc2)
                await self.notifier.error(f"trail-{trade.inst_id}",
                                          f"⚠️ {trade.inst_id}: не удалось перенести трейлинг-стоп: {_err(exc2)}")
                return False
            await self.client.cancel_algos([(trade.inst_id, old_algo)])
        trade.stop_loss = new_sl
        self.storage.update_trade(trade, "stop_loss", "best_price", "trailing_active", "algo_id", "algo_cl_id")
        log.info("%s: стоп перенесён %s → %s", trade.inst_id, old, new_sl)
        if announce:
            await self.notifier.notify(
                f"🔒 {messages.side_label(trade.side)} {trade.inst_id}: трейлинг включён, "
                f"стоп {info.fmt_price(old)} → <b>{info.fmt_price(new_sl)}</b>")
        return True

    # ================= сверка с биржей =================

    async def reconcile(self) -> None:
        async with self._lock:
            await self._reconcile()

    async def _reconcile(self) -> None:
        positions = await self.client.get_positions()
        balance = await self.client.get_balance()
        self.balance = balance
        await self._check_daily_limit(balance)
        by_inst: dict[str, list[Position]] = {}
        for p in positions:
            # позиции по инструментам из config и по тем, где сделка уже сопровождается (даже если их убрали)
            if p.inst_id not in self.symbols and p.inst_id not in self.trades:
                if p.inst_id not in self._warned:
                    self._warned.add(p.inst_id)
                    log.warning("Позиция %s не входит в список инструментов бота и не сопровождается", p.inst_id)
                continue
            by_inst.setdefault(p.inst_id, []).append(p)

        # 1. сделки, позиции которых больше нет — закрыты на бирже (SL/TP/вручную)
        for inst_id, trade in list(self.trades.items()):
            pos = next((p for p in by_inst.get(inst_id, []) if p.side == trade.side), None)
            if pos is None:
                stored = self.storage.get_trade(trade.id) if trade.id is not None else None
                if stored is not None and stored.status == "closed":  # закрыта другим процессом (CLI closeall)
                    self.trades.pop(inst_id, None)
                    continue
                await self._finalize_closed(trade)
            else:
                trade.missing_since = None
                if pos.mgn_mode and pos.mgn_mode != trade.mgn_mode:
                    trade.mgn_mode = pos.mgn_mode
                    self.storage.update_trade(trade, "mgn_mode")
                if abs(pos.contracts - trade.contracts) > 1e-9:
                    log.info("%s: размер позиции изменился %s → %s", inst_id, trade.contracts, pos.contracts)
                    trade.contracts = pos.contracts
                    self.storage.update_trade(trade, "contracts")

        # 2. позиции без записи в БД — берём на сопровождение (без дублей)
        for inst_id, plist in by_inst.items():
            for p in plist:
                trade = self.trades.get(inst_id)
                if trade is None:
                    if inst_id in self.symbols:
                        await self._adopt(p)
                elif trade.side != p.side and f"hedge-{inst_id}" not in self._warned:
                    self._warned.add(f"hedge-{inst_id}")
                    log.warning("%s: есть встречная позиция %s, она не сопровождается", inst_id, p.side)

        # 3. у каждой позиции должны быть SL/TP на бирже
        if self.trades:
            algos = await self.client.get_pending_tpsl()
            for inst_id, trade in list(self.trades.items()):
                pos = next((p for p in by_inst.get(inst_id, []) if p.side == trade.side), None)
                if pos is not None:
                    await self._ensure_protection(trade, pos, [a for a in algos if a.inst_id == inst_id])

    async def _adopt(self, pos: Position) -> Trade:
        algos = await self.client.get_pending_tpsl(pos.inst_id)
        algo = next((a for a in algos if a.protects(pos.side) and a.sl_trigger), None) \
            or next((a for a in algos if a.protects(pos.side)), None)
        levels = None
        try:
            candles = await self.client.fetch_candles(pos.inst_id, self.s.exchange.timeframe,
                                                      limit=self.s.exchange.candles_history)
            levels = self.strategy.protective_levels(candles, pos.side, pos.avg_px)
        except Exception as exc:  # noqa: BLE001
            log.warning("%s: не удалось рассчитать уровни для найденной позиции: %s", pos.inst_id, exc)
        info = self.instruments[pos.inst_id]
        sign = 1 if pos.side == "long" else -1
        if algo and algo.sl_trigger:
            sl = algo.sl_trigger
        elif levels:
            sl = levels.stop_loss
        else:
            sl = pos.avg_px * (1 - sign * 0.02)
        tp = algo.tp_trigger if algo and algo.tp_trigger else (levels.take_profit if levels else None)
        trade = Trade(
            inst_id=pos.inst_id, side=pos.side, pos_side=pos.pos_side, contracts=pos.contracts,
            entry_price=pos.avg_px, stop_loss=info.round_price(sl),
            take_profit=info.round_price(tp) if tp else None, initial_stop=info.round_price(sl),
            atr=levels.atr if levels else 0.0,
            trail_activation=levels.trail_activation if levels else None,
            trail_distance=levels.trail_distance if levels else None,
            opened_at=pos.c_time or self.now_ms(), ct_val=info.ct_val, mode=self.mode,
            strategy=self.strategy.name, best_price=pos.avg_px,
            algo_id=algo.algo_id if algo else "", algo_cl_id=algo.algo_cl_id if algo else "",
            note="adopted: позиция найдена на бирже", mgn_mode=pos.mgn_mode or self.s.exchange.margin_mode)
        self.storage.insert_trade(trade)
        self.trades[pos.inst_id] = trade
        self._reset_price_range(pos.inst_id)
        log.warning("Найдена позиция без записи в БД, беру на сопровождение: %s %s %s @ %s",
                    pos.side, pos.inst_id, pos.contracts, pos.avg_px)
        await self.notifier.notify(
            f"♻️ Найдена открытая позиция {messages.side_label(pos.side)} {pos.inst_id} "
            f"({pos.contracts:g} конт. @ {pos.avg_px:g}) — беру на сопровождение. "
            f"SL {info.fmt_price(trade.stop_loss)}"
            + (f", TP {info.fmt_price(trade.take_profit)}" if trade.take_profit else ""))
        return trade

    async def _ensure_protection(self, trade: Trade, pos: Position, algos: list[AlgoOrder]) -> None:
        info = self.instruments[trade.inst_id]
        mine = [a for a in algos if a.protects(trade.side)]
        current = next((a for a in mine if a.algo_id == trade.algo_id), None)
        if current is None and mine:
            current = next((a for a in mine if a.sl_trigger), mine[0])
            log.info("%s: привязываю существующий TP/SL %s", trade.inst_id, current.algo_id)
            trade.algo_id, trade.algo_cl_id = current.algo_id, current.algo_cl_id
            if current.sl_trigger:
                trade.stop_loss = current.sl_trigger
            if current.tp_trigger:
                trade.take_profit = current.tp_trigger
            self.storage.update_trade(trade, "algo_id", "algo_cl_id", "stop_loss", "take_profit")
        if current is not None:
            extras = [a for a in mine if a.algo_id != current.algo_id and a.sl_trigger
                      and a.algo_cl_id.startswith(CLIENT_ID_PREFIX)]
            if extras:
                log.info("%s: отменяю лишние TP/SL бота: %s", trade.inst_id, [a.algo_id for a in extras])
                await self.client.cancel_algos([(a.inst_id, a.algo_id) for a in extras])
            if current.sl_trigger is None:
                log.warning("%s: у TP/SL нет стоп-лосса, добавляю отдельный SL", trade.inst_id)
                await self._place_protection(trade, sl_only=True)
            elif not current.close_fraction and current.sz and abs(current.sz - pos.contracts) > 1e-9:
                try:
                    await self.client.amend_tpsl(inst_id=trade.inst_id, algo_id=current.algo_id,
                                                 sz=info.fmt_size(pos.contracts))
                except ExchangeError as exc:
                    log.warning("%s: не удалось изменить объём TP/SL: %s", trade.inst_id, exc)
            return

        # защиты нет совсем. Срезы позиций и ордеров не атомарны: возможно, TP/SL только что сработал
        # и позиции уже нет — перепроверяем, прежде чем что-то делать
        if not await self._position_exists(trade):
            return
        if any(a.protects(trade.side) for a in await self.client.get_pending_tpsl(trade.inst_id)):
            return  # ордер уже появился — привяжем на следующей сверке
        price = await self.price(trade.inst_id)
        long = trade.side == "long"
        if (long and price <= trade.stop_loss) or (not long and price >= trade.stop_loss):
            await self.notifier.notify(f"🚨 {trade.inst_id}: стоп-лосса на бирже нет, цена уже за стопом — "
                                       f"закрываю по рынку.")
            await self._close_trade_market(trade, "stop_loss_missing")
            return
        if trade.take_profit and ((long and price >= trade.take_profit) or (not long and price <= trade.take_profit)):
            await self.notifier.notify(f"ℹ️ {trade.inst_id}: TP на бирже нет, цена уже за тейком — фиксирую прибыль.")
            await self._close_trade_market(trade, "take_profit_missing")
            return
        try:
            await self._place_protection(trade)
            await self.notifier.notify(
                f"🛡 {trade.inst_id}: на бирже не было SL/TP — выставлены заново "
                f"(SL {info.fmt_price(trade.stop_loss)}"
                + (f", TP {info.fmt_price(trade.take_profit)})" if trade.take_profit else ")"))
        except InvalidOrder as exc:
            await self.notifier.notify(f"🚨 {trade.inst_id}: биржа не приняла SL/TP ({_err(exc)}). "
                                       f"Закрываю по рынку.")
            await self._close_trade_market(trade, "no_protection")

    async def _finalize_closed(self, trade: Trade, allow_estimate: bool = True) -> bool:
        """Записать итог сделки, позиции которой больше нет. False — данных пока нет, повторить позже."""
        closed = await self.client.get_closed_position(trade.inst_id, trade.side, trade.opened_at)
        info = self.instruments.get(trade.inst_id)
        if closed is None:
            now = self.now_ms()
            if trade.missing_since is None:
                trade.missing_since = now
            # история позиций OKX обновляется с задержкой — ждём, прежде чем оценивать PnL самим
            if not allow_estimate or now - trade.missing_since < HISTORY_WAIT_MS:
                return False
            if await self._position_exists(trade):  # позиция на месте: пустой ответ биржи был сбоем
                trade.missing_since = None
                return False
            exit_px = await self.price(trade.inst_id)
            pnl = trade.unrealized(exit_px)
            fee = None
            closed_at = self.now_ms()
            log.warning("%s: нет данных о закрытии в истории OKX, PnL оценён по текущей цене", trade.inst_id)
        else:
            exit_px, pnl, fee = closed.close_avg_px, closed.realized_pnl, closed.fee
            closed_at = closed.u_time or self.now_ms()
        if not trade.close_reason:
            trade.close_reason = self._classify_exit(trade, exit_px, closed.close_type if closed else "")
        trade.status, trade.exit_price, trade.pnl, trade.fee, trade.closed_at = "closed", exit_px, pnl, fee, closed_at
        self.storage.update_trade(trade)
        self.trades.pop(trade.inst_id, None)
        try:
            # остаточные TP/SL снимаем, только убедившись, что позиции по инструменту действительно нет
            if not await self._position_exists(trade):
                leftovers = [a for a in await self.client.get_pending_tpsl(trade.inst_id)
                             if a.protects(trade.side)]
                if leftovers:
                    await self.client.cancel_algos([(a.inst_id, a.algo_id) for a in leftovers])
        except (ExchangeError, NetworkError) as exc:
            log.warning("%s: не удалось убрать остаточные TP/SL: %s", trade.inst_id, exc)
        log.info("Закрыта %s %s: %s → %s, PnL %.4f (%s)", trade.side, trade.inst_id, trade.entry_price,
                 exit_px, pnl, trade.close_reason)
        await self.notifier.notify(messages.closed(trade, info, self.mode))
        return True

    def _classify_exit(self, trade: Trade, exit_px: float, close_type: str) -> str:
        if close_type in ("3", "4"):
            return "liquidation"
        if close_type == "5":
            return "adl"
        info = self.instruments.get(trade.inst_id)
        tick = info.tick_size if info else 0.0
        tol = max(tick * 3, 0.3 * trade.atr) if trade.atr else max(tick * 3, exit_px * 0.002)
        if trade.take_profit and abs(exit_px - trade.take_profit) <= tol:
            return "take_profit"
        if abs(exit_px - trade.stop_loss) <= tol:
            return "trailing_stop" if trade.trailing_active else "stop_loss"
        return "closed_externally"

    async def _close_trade_market(self, trade: Trade, reason: str) -> None:
        if await self.client.close_position(trade.inst_id, trade.mgn_mode, trade.pos_side):
            trade.close_reason = reason
            self.storage.update_trade(trade, "close_reason")
        for _ in range(5):
            await asyncio.sleep(self.poll_delay)
            positions = await self.client.get_positions()
            if not any(p.inst_id == trade.inst_id and p.side == trade.side for p in positions):
                break
        else:
            log.error("%s: позиция всё ещё открыта после закрытия по рынку", trade.inst_id)
            return
        for _ in range(4):
            if await self._finalize_closed(trade, allow_estimate=False):
                return
            await asyncio.sleep(self.poll_delay)
        log.info("%s: итог закрытия ещё не в истории OKX — зафиксирую на следующих сверках", trade.inst_id)

    # ================= команды =================

    async def close_all(self) -> CloseAllResult:
        """Аварийная остановка: отменить все ордера и закрыть все позиции SWAP, поставить бота на паузу."""
        result = CloseAllResult()
        async with self._lock:
            self.set_paused(True)
            log.warning("АВАРИЙНОЕ ЗАКРЫТИЕ: отменяю ордера и закрываю все позиции")
            try:
                result.algos_canceled = await self.client.cancel_all_algos()
            except Exception as exc:  # noqa: BLE001
                result.errors.append(f"algo-ордера: {exc}")
            try:
                result.orders_canceled = await self.client.cancel_all_orders()
            except Exception as exc:  # noqa: BLE001
                result.errors.append(f"ордера: {exc}")
            positions: list[Position] = await self.client.get_positions()
            initial = {(p.inst_id, p.side) for p in positions}
            for _ in range(5):
                if not positions:
                    break
                for p in positions:
                    try:
                        closed = await self.client.close_position(p.inst_id, p.mgn_mode, p.pos_side)
                    except Exception as exc:  # noqa: BLE001
                        result.errors.append(f"{p.inst_id}: {exc}")
                        continue
                    if closed:
                        trade = self.trades.get(p.inst_id)
                        if trade and trade.side == p.side and not trade.close_reason:
                            trade.close_reason = "close_all"
                            self.storage.update_trade(trade, "close_reason")
                await asyncio.sleep(self.poll_delay * 2)
                positions = await self.client.get_positions()  # итог — всегда по свежему запросу
            result.remaining = [f"{p.side} {p.inst_id}" for p in positions]
            result.positions_closed = len(initial - {(p.inst_id, p.side) for p in positions})
            for _ in range(4):
                await self._reconcile()
                if not self.trades:
                    break
                await asyncio.sleep(self.poll_delay * 2)
        text = (f"🛑 <b>Аварийное закрытие</b> [{self.mode}]: закрыто позиций {result.positions_closed}, "
                f"отменено algo-ордеров {result.algos_canceled}, ордеров {result.orders_canceled}.\n"
                f"Бот на паузе — /start чтобы возобновить.")
        if result.remaining:
            text += f"\n🚨 Остались открытыми: {', '.join(result.remaining)} — проверьте на бирже!"
        if result.errors:
            text += "\nОшибки: " + "; ".join(escape(e[:150]) for e in result.errors[:5])
        await self.notifier.notify(text)
        return result

    async def status_view(self) -> messages.StatusView:
        balance, positions = await asyncio.gather(self.client.get_balance(), self.client.get_positions())
        self.balance = balance
        start = self.storage.get_state("day_start_equity")
        day_pnl = balance.equity - start if start else None
        day_pct = day_pnl / start * 100 if start else None
        day_start_ms, _ = self.day_bounds_ms(self.day_key())
        closed = self.storage.closed_trades(day_start_ms)
        views = []
        for p in positions:
            t = self.trades.get(p.inst_id)
            managed = t is not None and t.side == p.side
            views.append(messages.PositionView(
                inst_id=p.inst_id, side=p.side, contracts=p.contracts, entry=p.avg_px, mark=p.mark_px,
                upl=p.upl, stop_loss=t.stop_loss if managed else None,
                take_profit=t.take_profit if managed else None,
                trailing=bool(managed and t.trailing_active), managed=managed))
        return messages.StatusView(
            mode=self.mode, state=self.state_label, equity=balance.equity, available=balance.available,
            day_pnl=day_pnl, day_pnl_pct=day_pct, realized_today=sum(t.pnl or 0 for t in closed),
            trades_today=len(closed), daily_limit_pct=self.s.risk.daily_loss_limit_pct, positions=views,
            ws_connected=self.price_feed.connected if self.price_feed else None)

    def report_text(self, days: int | None = None) -> str:
        since = self.now_ms() - days * 86_400_000 if days else None
        trades = self.storage.closed_trades(since)
        stats = trade_stats([t.pnl or 0.0 for t in trades])
        period = f"за {days} дн." if days else "за всё время"
        return messages.report(stats, f"{period} [{self.mode}]", trades[-5:][::-1])
