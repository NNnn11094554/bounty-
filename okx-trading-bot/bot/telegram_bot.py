"""Telegram: уведомления и управление ботом. Отвечает только владельцу (TELEGRAM_CHAT_ID).

Сбои Telegram не влияют на торговлю: сообщения копятся в очереди и отправляются,
когда связь восстановится.
"""

from __future__ import annotations

import asyncio
import logging
import re
from typing import TYPE_CHECKING

from telegram import BotCommand, InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ParseMode
from telegram.error import BadRequest, Forbidden, InvalidToken, NetworkError, RetryAfter, TimedOut
from telegram.ext import Application, CallbackQueryHandler, CommandHandler, ContextTypes, MessageHandler, filters

from . import messages
from .exchange import backoff_delay
from .notifier import Notifier

if TYPE_CHECKING:
    from .trader import Trader

log = logging.getLogger("bot.telegram")

COMMANDS = [
    ("status", "баланс, позиции, PnL за день"),
    ("stop", "пауза: не открывать новые сделки"),
    ("start", "возобновить торговлю"),
    ("closeall", "закрыть все позиции и отменить ордера"),
    ("report", "статистика (можно /report 7)"),
    ("help", "список команд"),
]
HELP = "🤖 <b>Команды</b>\n" + "\n".join(f"/{c} — {d}" for c, d in COMMANDS)
_TAG_RE = re.compile(r"<[^>]+>")


def _seconds(value) -> float:
    return value.total_seconds() if hasattr(value, "total_seconds") else float(value)


class TelegramBot(Notifier):
    def __init__(self, token: str, chat_id: int):
        super().__init__()
        self.chat_id = int(chat_id)
        self.trader: Trader | None = None
        self.app = (Application.builder().token(token)
                    .connect_timeout(15).read_timeout(30).write_timeout(30).build())
        self._queue: asyncio.Queue[str] = asyncio.Queue(maxsize=500)
        self._task: asyncio.Task | None = None
        self.online = False

        owner = filters.Chat(chat_id=self.chat_id)
        handlers = {
            "status": self.cmd_status, "stop": self.cmd_stop, "start": self.cmd_start,
            "closeall": self.cmd_closeall, "report": self.cmd_report, "help": self.cmd_help,
        }
        for name, cb in handlers.items():
            self.app.add_handler(CommandHandler(name, cb, filters=owner))
        self.app.add_handler(CallbackQueryHandler(self.on_callback, pattern=r"^closeall:"))
        self.app.add_handler(MessageHandler(~owner, self.on_stranger))
        self.app.add_error_handler(self.on_error)

    def attach(self, trader: Trader) -> None:
        self.trader = trader

    # ---------- уведомления ----------

    async def send(self, text: str) -> None:
        log.info("[telegram] %s", _TAG_RE.sub("", text).replace("\n", " | ")[:500])
        if self._queue.full():
            self._queue.get_nowait()  # при долгом отсутствии связи храним самые свежие
        self._queue.put_nowait(text)

    async def _deliver(self, text: str) -> None:
        for attempt in range(1, 6):
            try:
                await self.app.bot.send_message(self.chat_id, text[:4096], parse_mode=ParseMode.HTML,
                                                disable_web_page_preview=True)
                return
            except RetryAfter as exc:
                await asyncio.sleep(_seconds(exc.retry_after) + 1)
            except (TimedOut, NetworkError) as exc:
                if isinstance(exc, BadRequest):
                    await self.app.bot.send_message(self.chat_id, _TAG_RE.sub("", text)[:4096])
                    return
                log.warning("Telegram: %s, повтор %d", exc, attempt)
                await asyncio.sleep(backoff_delay(attempt, base=2, cap=60))
            except Forbidden as exc:
                log.error("Telegram: бот заблокирован или нет доступа к чату %s: %s", self.chat_id, exc)
                return
        log.error("Telegram: сообщение не доставлено: %s", _TAG_RE.sub("", text)[:200])

    # ---------- жизненный цикл ----------

    async def start(self) -> None:
        self._task = asyncio.create_task(self._run(), name="telegram")

    async def _run(self) -> None:
        attempt = 0
        while True:
            try:
                if not self.app._initialized:  # noqa: SLF001
                    await self.app.initialize()
                if not self.app.running:
                    await self.app.start()
                if not self.app.updater.running:
                    await self.app.updater.start_polling(drop_pending_updates=True,
                                                         allowed_updates=["message", "callback_query"])
                await self.app.bot.set_my_commands([BotCommand(c, d) for c, d in COMMANDS])
                break
            except asyncio.CancelledError:
                raise
            except InvalidToken:
                log.error("Telegram: неверный TELEGRAM_BOT_TOKEN — уведомления отключены")
                return
            except Exception as exc:  # noqa: BLE001
                attempt += 1
                delay = backoff_delay(attempt, base=5, cap=300)
                log.warning("Telegram недоступен (%s), повтор через %.0fс", exc, delay)
                await asyncio.sleep(delay)
        self.online = True
        log.info("Telegram-бот запущен, владелец chat_id=%s", self.chat_id)
        while True:
            text = await self._queue.get()
            try:
                await self._deliver(text)
            except Exception:  # noqa: BLE001
                log.exception("Telegram: ошибка отправки")

    async def stop(self, flush_timeout: float = 5.0) -> None:
        if self.online:
            loop = asyncio.get_running_loop()
            deadline = loop.time() + flush_timeout
            while not self._queue.empty() and loop.time() < deadline:
                await asyncio.sleep(0.1)
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001
                pass
        try:
            if self.app.updater and self.app.updater.running:
                await self.app.updater.stop()
            if self.app.running:
                await self.app.stop()
            if self.app._initialized:  # noqa: SLF001
                await self.app.shutdown()
        except Exception as exc:  # noqa: BLE001
            log.warning("Telegram: ошибка при остановке: %s", exc)

    # ---------- команды ----------

    async def _reply(self, update: Update, text: str, **kwargs) -> None:
        if update.effective_message:
            await update.effective_message.reply_text(text[:4096], parse_mode=ParseMode.HTML,
                                                      disable_web_page_preview=True, **kwargs)

    def _trader_ready(self) -> bool:
        return self.trader is not None and self.trader.ready

    async def cmd_help(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        await self._reply(update, HELP)

    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self._trader_ready():
            await self._reply(update, "⏳ Бот запускается или нет связи с биржей, попробуйте позже.")
            return
        try:
            view = await self.trader.status_view()
            await self._reply(update, messages.status(view))
        except Exception as exc:  # noqa: BLE001
            log.exception("/status")
            await self._reply(update, f"⚠️ Не удалось получить статус: {type(exc).__name__}: {str(exc)[:200]}")

    async def cmd_stop(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if self.trader is None:
            return
        self.trader.set_paused(True)
        log.warning("Пауза по команде /stop")
        await self._reply(update, "⏸ <b>Пауза.</b> Новые сделки не открываются. Открытые позиции "
                                  "сопровождаются (SL/TP на бирже, трейлинг). /start — возобновить.")

    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if self.trader is None:
            return
        self.trader.set_paused(False)
        log.warning("Торговля возобновлена командой /start")
        text = f"▶️ <b>Торговля возобновлена</b> [{self.trader.mode}]."
        if self.trader.daily_limit_hit:
            text += "\n⛔ Но дневной лимит убытка уже достигнут — новые сделки со следующего дня."
        await self._reply(update, text + "\n\n" + HELP)

    async def cmd_report(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if self.trader is None:
            return
        days = None
        if context.args:
            try:
                days = max(1, int(context.args[0]))
            except ValueError:
                await self._reply(update, "Использование: /report или /report 7")
                return
        await self._reply(update, self.trader.report_text(days))

    async def cmd_closeall(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("🛑 Да, закрыть всё", callback_data="closeall:yes"),
            InlineKeyboardButton("Отмена", callback_data="closeall:no"),
        ]])
        await self._reply(update, "⚠️ Закрыть <b>все</b> позиции по рынку, отменить все ордера и "
                                  "поставить бота на паузу?", reply_markup=keyboard)

    async def on_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        query = update.callback_query
        if query is None:
            return
        if update.effective_chat is None or update.effective_chat.id != self.chat_id:
            log.warning("Нажатие кнопки из чужого чата %s", update.effective_chat)
            await query.answer()
            return
        await query.answer()
        if query.data != "closeall:yes":
            await query.edit_message_text("Отменено.")
            return
        if not self._trader_ready():
            await query.edit_message_text("⏳ Нет связи с биржей. Повторите позже или выполните на сервере: "
                                          "docker compose exec bot python -m bot closeall")
            return
        await query.edit_message_text("⏳ Закрываю позиции и отменяю ордера…")
        try:
            result = await self.trader.close_all()
            done = "✅ Готово" if not result.remaining else "🚨 Не всё закрыто"
            await query.edit_message_text(f"{done}, подробности в следующем сообщении.")
        except Exception as exc:  # noqa: BLE001
            log.exception("closeall")
            await query.edit_message_text(f"🚨 Ошибка аварийного закрытия: {str(exc)[:300]}. "
                                          f"Проверьте позиции на бирже!")

    async def on_stranger(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        user = update.effective_user
        log.warning("Сообщение от постороннего: chat=%s user=%s (%s) — игнорирую",
                    update.effective_chat.id if update.effective_chat else None,
                    user.id if user else None, user.username if user else None)

    async def on_error(self, update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        log.warning("Telegram: %s", context.error)
