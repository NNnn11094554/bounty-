"""Точка входа.

    python -m bot run         торговля 24/7 (по умолчанию DEMO)
    python -m bot check       проверка ключей, связи с OKX, WebSocket и Telegram
    python -m bot backtest    бэктест на истории OKX
    python -m bot closeall    аварийно закрыть всё (без Telegram)
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import signal
import sys
import threading
import time
from datetime import datetime, UTC
from pathlib import Path

from . import __version__
from .backtest import (
    Backtester,
    default_instrument,
    format_report,
    load_candles_csv,
    save_candles_csv,
    save_report,
    synthetic_candles,
)
from .config import Settings, load_settings
from .exchange import OkxClient
from .logger import setup_logging
from .models import Candles
from .notifier import Notifier
from .storage import Storage
from .strategies import create_strategy
from .trader import FatalConfigError, Trader
from .ws_prices import PriceFeed

log = logging.getLogger("bot")


def make_client(settings: Settings, demo: bool | None = None) -> OkxClient:
    s = settings.secrets
    return OkxClient(api_key=s.okx_api_key, secret=s.okx_api_secret, passphrase=s.okx_api_passphrase,
                     demo=settings.demo if demo is None else demo, hostname=settings.exchange.hostname,
                     timeout_sec=settings.exchange.request_timeout_sec)


class Watchdog(threading.Thread):
    """Если торговый цикл завис, завершает процесс — Docker (restart: always) перезапустит бота."""

    def __init__(self, trader: Trader, timeout: float):
        super().__init__(daemon=True, name="watchdog")
        self.trader = trader
        self.timeout = timeout
        self._stop_evt = threading.Event()

    def run(self) -> None:
        while not self._stop_evt.wait(15):
            idle = time.monotonic() - self.trader.last_heartbeat
            if idle > self.timeout:
                log.critical("Торговый цикл не отвечает %.0f с — аварийный перезапуск процесса", idle)
                logging.shutdown()
                os._exit(1)

    def stop(self) -> None:
        self._stop_evt.set()


# ---------------- run ----------------

def build_components(settings: Settings) -> tuple[Storage, OkxClient, Notifier, PriceFeed, Trader]:
    storage = Storage(settings.database_path)
    client = make_client(settings)
    strategy = create_strategy(settings.strategy.name, settings.strategy.params)
    notifier: Notifier
    if settings.secrets.telegram_enabled:
        from .telegram_bot import TelegramBot
        notifier = TelegramBot(settings.secrets.telegram_bot_token, settings.secrets.telegram_chat_id)
    else:
        log.warning("Telegram не настроен (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID) — уведомления только в лог")
        notifier = Notifier()
    feed = PriceFeed(settings.ws_url, settings.exchange.symbols, client.fetch_ticker_price,
                     stale_after=settings.trading.price_stale_sec)
    trader = Trader(settings, client, storage, strategy, notifier, price_feed=feed,
                    heartbeat_path=str(Path(settings.database_path).parent / "heartbeat"))
    return storage, client, notifier, feed, trader


async def run_bot(settings: Settings) -> int:
    if not settings.secrets.has_okx_keys:
        log.critical("Не заданы OKX_API_KEY / OKX_API_SECRET / OKX_API_PASSPHRASE в .env")
        return 2
    log.info("OKX bot v%s, режим %s", __version__, settings.mode)
    if not settings.demo:
        log.warning("!!! LIVE-РЕЖИМ: торговля реальными деньгами !!!")

    storage, client, notifier, feed, trader = build_components(settings)
    if hasattr(notifier, "attach"):
        notifier.attach(trader)
        await notifier.start()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, trader.stop)
        except NotImplementedError:  # Windows
            pass

    watchdog = Watchdog(trader, settings.trading.watchdog_timeout_sec)
    watchdog.start()
    feed_task = asyncio.create_task(feed.run(), name="ws-prices")
    code = 0
    try:
        await trader.run()
    except FatalConfigError:
        code = 3
        log.critical("Бот остановлен из-за ошибки настройки. Исправьте и перезапустите контейнер.")
        # не выходим, чтобы restart: always не перезапускал бота по кругу
        while not trader._stop.is_set():  # noqa: SLF001
            trader.touch_heartbeat()
            await trader._sleep(30)  # noqa: SLF001
    finally:
        log.info("Остановка…")
        watchdog.stop()
        await notifier.notify(f"⏹ Бот остановлен [{settings.mode}]. Позиции на бирже остаются со своими SL/TP.")
        await feed.stop()
        feed_task.cancel()
        try:
            await feed_task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
        if hasattr(notifier, "stop"):
            await notifier.stop()
        await client.close()
        storage.close()
    return code


# ---------------- closeall ----------------

async def run_closeall(settings: Settings) -> int:
    if not settings.secrets.has_okx_keys:
        print("Не заданы ключи OKX в .env")
        return 2
    storage = Storage(settings.database_path)
    client = make_client(settings)
    notifier = Notifier()
    trader = Trader(settings, client, storage, create_strategy(settings.strategy.name, settings.strategy.params),
                    notifier)
    try:
        trader.instruments = await client.load_instruments(settings.exchange.symbols)
        trader.pos_mode = (await client.get_account_config()).pos_mode
        trader.trades = {t.inst_id: t for t in storage.open_trades()}
        trader.ready = True
        result = await trader.close_all()
        print(f"Закрыто позиций: {result.positions_closed}, отменено algo: {result.algos_canceled}, "
              f"ордеров: {result.orders_canceled}. Бот поставлен на паузу (/start в Telegram для возобновления).")
        if result.remaining:
            print("ВНИМАНИЕ, остались открытыми:", ", ".join(result.remaining))
        if result.errors:
            print("Ошибки:", *result.errors, sep="\n  ")
        if settings.secrets.telegram_enabled:
            await _telegram_send(settings, f"🛑 Аварийное закрытие из консоли [{settings.mode}]: закрыто позиций "
                                           f"{result.positions_closed}, бот на паузе.")
        return 1 if result.remaining else 0
    finally:
        await client.close()
        storage.close()


async def _telegram_send(settings: Settings, text: str) -> bool:
    from telegram import Bot
    try:
        async with Bot(settings.secrets.telegram_bot_token) as bot:
            await bot.send_message(settings.secrets.telegram_chat_id, text)
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("Telegram: %s", exc)
        return False


# ---------------- check ----------------

async def run_check(settings: Settings) -> int:
    ok = True

    def report(passed: bool, text: str, critical: bool = True) -> None:
        nonlocal ok
        print(("✅ " if passed else ("❌ " if critical else "⚠️  ")) + text)
        if not passed and critical:
            ok = False

    print(f"Режим: {settings.mode} ({'x-simulated-trading: 1' if settings.demo else 'РЕАЛЬНЫЕ ДЕНЬГИ'})")
    print(f"Инструменты: {', '.join(settings.exchange.symbols)}, {settings.exchange.timeframe}, "
          f"{settings.exchange.leverage}x {settings.exchange.margin_mode}")
    report(settings.secrets.has_okx_keys, "Ключи OKX заданы в .env")
    client = make_client(settings)
    try:
        try:
            server = await client.server_time_ms()
            drift = abs(server - time.time() * 1000) / 1000
            report(drift < 5, f"Связь с OKX, расхождение часов {drift:.2f} с (нужно < 30 с)")
        except Exception as exc:  # noqa: BLE001
            report(False, f"Нет связи с OKX ({settings.exchange.hostname}): {exc}")
            return 1
        try:
            instruments = await client.load_instruments(settings.exchange.symbols)
            for i in instruments.values():
                report(True, f"{i.inst_id}: ctVal {i.ct_val}, lotSz {i.lot_sz}, minSz {i.min_sz}, "
                             f"tickSz {i.tick_sz}, max {i.max_lever:g}x")
        except Exception as exc:  # noqa: BLE001
            report(False, f"Инструменты: {exc}")
            instruments = {}
        if settings.secrets.has_okx_keys:
            try:
                acc = await client.get_account_config()
                report(acc.acct_lv != "1", f"Аккаунт: режим {acc.acct_lv} (нужен 2+), позиции: {acc.pos_mode}")
                bal = await client.get_balance()
                report(bal.equity > 0, f"Баланс USDT: equity {bal.equity:,.2f}, свободно {bal.available:,.2f}")
                positions = await client.get_positions()
                report(True, f"Открытых позиций SWAP: {len(positions)}", critical=False)
                algos = await client.get_pending_tpsl()
                report(True, f"Висящих TP/SL: {len(algos)}", critical=False)
            except Exception as exc:  # noqa: BLE001
                report(False, f"Приватный API: {type(exc).__name__}: {exc}. Проверьте ключи, passphrase, "
                              f"IP-привязку и что ключ создан в режиме {settings.mode}.")
        strategy = create_strategy(settings.strategy.name, settings.strategy.params)
        for inst_id in instruments:
            try:
                candles = await client.fetch_candles(inst_id, settings.exchange.timeframe,
                                                     limit=settings.exchange.candles_history)
                sig = strategy.generate_signal(candles)
                ind = strategy.compute(candles)
                last = {k: float(v[-1]) for k, v in ind.items()}
                report(len(candles) >= strategy.min_candles,
                       f"{inst_id}: {len(candles)} свечей, последний close {candles.close[-1]:g}, "
                       + ", ".join(f"{k}={v:.6g}" for k, v in last.items())
                       + (f" → сигнал {sig.side}" if sig else " → сигнала нет"))
            except Exception as exc:  # noqa: BLE001
                report(False, f"{inst_id}: свечи: {exc}")
        feed = PriceFeed(settings.ws_url, settings.exchange.symbols, client.fetch_ticker_price)
        task = asyncio.create_task(feed.run())
        for _ in range(50):
            if all(feed.is_fresh(i) for i in settings.exchange.symbols):
                break
            await asyncio.sleep(0.2)
        report(all(feed.is_fresh(i) for i in settings.exchange.symbols),
               f"WebSocket {settings.ws_url}: цены получены", critical=False)
        await feed.stop()
        task.cancel()
        if settings.secrets.telegram_enabled:
            sent = await _telegram_send(settings, f"✅ Проверка связи: бот OKX [{settings.mode}] видит этот чат.")
            report(sent, "Telegram: тестовое сообщение отправлено", critical=False)
        else:
            report(False, "Telegram не настроен", critical=False)
    finally:
        await client.close()
    print("\nИтог:", "всё готово к запуску" if ok else "есть ошибки — см. выше")
    return 0 if ok else 1


# ---------------- backtest ----------------

async def run_backtest(settings: Settings, args: argparse.Namespace) -> int:
    symbols = [s.upper() for s in (args.symbols or settings.exchange.symbols)]
    months = args.months or settings.backtest.months
    bt_cfg = settings.backtest.model_copy(update={"initial_balance": args.balance}) if args.balance \
        else settings.backtest
    tf = settings.exchange.timeframe
    tf_ms = settings.exchange.timeframe_ms
    strategy = create_strategy(settings.strategy.name, settings.strategy.params)
    end_ms = int(time.time() * 1000) // tf_ms * tf_ms
    start_ms = end_ms - int(months * 30.4375 * 86_400_000)
    warmup_ms = strategy.min_candles * tf_ms  # история для «прогрева» индикаторов
    data: dict[str, Candles] = {}
    instruments = {s: default_instrument(s) for s in symbols}

    if args.synthetic:
        source = "СИНТЕТИЧЕСКИЕ данные (проверка механики, не оценка доходности!)"
        bars = int((end_ms - start_ms + warmup_ms) // tf_ms)
        for k, s in enumerate(symbols):
            data[s] = synthetic_candles(s, start_ms - warmup_ms, bars, tf_ms, seed=args.seed + k)
    elif args.csv_dir:
        source = f"CSV из {args.csv_dir}"
        for s in symbols:
            data[s] = load_candles_csv(Path(args.csv_dir) / f"{s}.csv")
    else:
        source = "история OKX (/api/v5/market/history-candles)"
        client = make_client(settings, demo=False)  # публичные данные, ключи не нужны
        try:
            await client.server_time_ms()
        except Exception as exc:  # noqa: BLE001
            await client.close()
            print(f"Нет доступа к OKX ({settings.exchange.hostname}): {type(exc).__name__}: {str(exc)[:200]}\n"
                  f"Проверьте сеть или запустите бэктест по своим данным: --csv-dir DIR, либо --synthetic.",
                  file=sys.stderr)
            return 1
        try:
            instruments = await client.load_instruments(symbols)
            cache = Path(settings.backtest.cache_dir)
            for s in symbols:
                day = lambda ms: datetime.fromtimestamp(ms / 1000, tz=UTC).strftime("%Y%m%d")  # noqa: E731
                path = cache / f"{s}_{tf}_{day(start_ms - warmup_ms)}_{day(end_ms)}.csv"
                if path.exists():
                    data[s] = load_candles_csv(path)
                    print(f"{s}: {len(data[s])} свечей из кэша {path}")
                    continue
                print(f"{s}: загрузка истории {tf} с OKX…", flush=True)
                data[s] = await client.fetch_history_candles(
                    s, tf, start_ms - warmup_ms, end_ms,
                    progress=lambda n, s=s: print(f"\r{s}: {n} свечей", end="", flush=True))
                print()
                save_candles_csv(data[s], path)
        finally:
            await client.close()

    for s, c in data.items():
        if len(c) < strategy.min_candles:
            print(f"{s}: мало данных ({len(c)} свечей)")
            return 1
    result = Backtester(strategy, instruments, settings.risk, bt_cfg, settings.exchange.leverage, tf,
                        settings.trading.trailing_min_step_atr).run(data)
    text = format_report(result, source)
    text += (f"\nПараметры: риск {settings.risk.risk_per_trade_pct}%/сделку, макс. позиций "
             f"{settings.risk.max_open_positions}, дневной лимит {settings.risk.daily_loss_limit_pct}%, плечо "
             f"{settings.exchange.leverage}x; комиссия {bt_cfg.taker_fee_pct}%/сторона, проскальзывание "
             f"{bt_cfg.slippage_pct}%, фандинг {bt_cfg.funding_rate_8h_pct}%/8ч\n"
             f"Стратегия: {strategy.name} {strategy.params}")
    print(text)
    paths = save_report(result, text, bt_cfg.reports_dir)
    print("\nФайлы:", *(str(p) for p in paths.values()), sep="\n  ")
    return 0


# ---------------- CLI ----------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="python -m bot", description="Торговый бот OKX USDT-M perpetual swaps")
    p.add_argument("--config", help="путь к config.yaml (по умолчанию CONFIG_PATH или ./config.yaml)")
    p.add_argument("--env", default=".env", help="путь к .env")
    sub = p.add_subparsers(dest="command")
    sub.add_parser("run", help="запустить торговлю")
    sub.add_parser("check", help="проверить ключи, связь с OKX и Telegram")
    bt = sub.add_parser("backtest", help="бэктест на исторических данных")
    bt.add_argument("--months", type=float, help="период в месяцах (по умолчанию из config.yaml)")
    bt.add_argument("--symbols", nargs="+", help="инструменты, например BTC-USDT-SWAP")
    bt.add_argument("--balance", type=float, help="начальный баланс USDT")
    bt.add_argument("--csv-dir", help="брать свечи из CSV (<INST_ID>.csv: ts,open,high,low,close,volume)")
    bt.add_argument("--synthetic", action="store_true", help="синтетические данные (без сети)")
    bt.add_argument("--seed", type=int, default=42, help="seed синтетических данных")
    ca = sub.add_parser("closeall", help="аварийно закрыть все позиции и отменить ордера")
    ca.add_argument("--yes", action="store_true", help="без подтверждения")
    return p


def cli(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    command = args.command or "run"
    try:
        settings = load_settings(args.config, args.env)
    except Exception as exc:  # noqa: BLE001
        print(f"Ошибка конфигурации: {exc}", file=sys.stderr)
        sys.exit(2)
    if command == "backtest":
        settings = settings.model_copy(update={"logging": settings.logging.model_copy(update={"level": "WARNING"})})
    setup_logging(settings.logging, settings.secrets.values_to_redact())

    if command == "run":
        code = asyncio.run(run_bot(settings))
    elif command == "check":
        code = asyncio.run(run_check(settings))
    elif command == "backtest":
        code = asyncio.run(run_backtest(settings, args))
    elif command == "closeall":
        if not args.yes:
            answer = input(f"[{settings.mode}] Закрыть ВСЕ позиции SWAP и отменить все ордера? Введите YES: ")
            if answer.strip() != "YES":
                print("Отменено")
                sys.exit(1)
        code = asyncio.run(run_closeall(settings))
    else:
        code = 2
    sys.exit(code)
