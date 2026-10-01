"""Woof Kombat: Telegram-бот + API + раздача мини-аппа в одном процессе."""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import sqlite3
import time
from pathlib import Path
from urllib.parse import parse_qsl

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)
from aiohttp import web

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("woof")

BOT_TOKEN = os.environ["BOT_TOKEN"]
WEBAPP_URL = os.environ.get("WEBAPP_URL", "")  # публичный https-адрес этого сервера
PORT = int(os.environ.get("PORT", "8080"))
DB_PATH = os.environ.get("DB_PATH", str(Path(__file__).parent / "woof.db"))
CHANNEL_URL = os.environ.get("CHANNEL_URL", "https://t.me/telegram")
CHAT_URL = os.environ.get("CHAT_URL", "https://t.me/telegram")
WEBAPP_DIR = Path(__file__).resolve().parent.parent / "webapp"

REF_BONUS = 5_000
REF_BONUS_PREMIUM = 25_000
INIT_DATA_MAX_AGE = 24 * 3600
MAX_STATE_BYTES = 50_000

bot = Bot(BOT_TOKEN)
dp = Dispatcher()
BOT_USERNAME = ""

# ---------- База ----------

db = sqlite3.connect(DB_PATH, check_same_thread=False)
db.row_factory = sqlite3.Row
db.executescript(
    """
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        state TEXT,
        referrer INTEGER,
        ref_bonus INTEGER DEFAULT 0,
        pending_bonus INTEGER DEFAULT 0,
        created INTEGER,
        updated INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referrer);
    """
)


def register_user(user_id: int, name: str, is_premium: bool, referrer: int | None) -> None:
    """Создаёт пользователя; реферер засчитывается только для новых игроков."""
    now = int(time.time())
    exists = db.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
    if exists:
        db.execute("UPDATE users SET name = ? WHERE id = ?", (name, user_id))
        db.commit()
        return

    valid_ref = None
    if referrer and referrer != user_id:
        if db.execute("SELECT 1 FROM users WHERE id = ?", (referrer,)).fetchone():
            valid_ref = referrer

    bonus = REF_BONUS_PREMIUM if is_premium else REF_BONUS
    db.execute(
        "INSERT INTO users (id, name, referrer, ref_bonus, pending_bonus, created, updated)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        (user_id, name, valid_ref, bonus if valid_ref else 0, bonus if valid_ref else 0, now, now),
    )
    if valid_ref:
        db.execute(
            "UPDATE users SET pending_bonus = pending_bonus + ? WHERE id = ?", (bonus, valid_ref)
        )
    db.commit()


def parse_ref(payload: str | None) -> int | None:
    if payload and payload.startswith("ref_"):
        try:
            return int(payload[4:])
        except ValueError:
            return None
    return None


def display_name(user: dict) -> str:
    parts = [user.get("first_name"), user.get("last_name")]
    return " ".join(p for p in parts if p) or user.get("username") or "Игрок"


# ---------- Проверка initData ----------


def validate_init_data(init_data: str) -> dict | None:
    """Проверка подписи по https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app"""
    if not init_data:
        return None
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        return None
    check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    calc = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc, received_hash):
        return None
    if time.time() - int(pairs.get("auth_date", 0)) > INIT_DATA_MAX_AGE:
        return None
    try:
        pairs["user"] = json.loads(pairs.get("user", "{}"))
    except json.JSONDecodeError:
        return None
    if not pairs["user"].get("id"):
        return None
    return pairs


# ---------- API ----------


LEVEL_MINS = [0, 5_000, 25_000, 100_000, 1_000_000, 2_000_000, 10_000_000, 50_000_000, 100_000_000, 1_000_000_000]


def friends_of(user_id: int) -> list[dict]:
    rows = db.execute(
        "SELECT name, state, ref_bonus FROM users WHERE referrer = ? ORDER BY created DESC LIMIT 100",
        (user_id,),
    ).fetchall()
    result = []
    for r in rows:
        try:
            st = json.loads(r["state"] or "{}")
        except json.JSONDecodeError:
            st = {}
        total = st.get("totalEarned", 0) if isinstance(st, dict) else 0
        level = sum(1 for m in LEVEL_MINS[1:] if total >= m)
        result.append({"name": r["name"], "coins": total, "level": level, "bonus": r["ref_bonus"]})
    return result


async def read_auth(request: web.Request) -> tuple[dict, dict]:
    if request.content_length and request.content_length > MAX_STATE_BYTES + 10_000:
        raise web.HTTPRequestEntityTooLarge(MAX_STATE_BYTES, request.content_length)
    try:
        body = await request.json()
    except Exception:
        raise web.HTTPBadRequest(text="bad json")
    auth = validate_init_data(body.get("initData", ""))
    if not auth:
        raise web.HTTPUnauthorized(text="bad initData")
    return body, auth


async def api_load(request: web.Request) -> web.Response:
    _, auth = await read_auth(request)
    user = auth["user"]
    uid = int(user["id"])
    register_user(uid, display_name(user), bool(user.get("is_premium")), parse_ref(auth.get("start_param")))

    row = db.execute("SELECT state, pending_bonus FROM users WHERE id = ?", (uid,)).fetchone()
    bonus = row["pending_bonus"] or 0
    if bonus:
        db.execute("UPDATE users SET pending_bonus = 0 WHERE id = ?", (uid,))
        db.commit()
    state = json.loads(row["state"]) if row["state"] else None
    return web.json_response({"state": state, "friends": friends_of(uid), "bonus": bonus})


async def api_save(request: web.Request) -> web.Response:
    body, auth = await read_auth(request)
    uid = int(auth["user"]["id"])
    state = body.get("state")
    if not isinstance(state, dict):
        raise web.HTTPBadRequest(text="bad state")
    raw = json.dumps(state, separators=(",", ":"))
    if len(raw) > MAX_STATE_BYTES:
        raise web.HTTPRequestEntityTooLarge(MAX_STATE_BYTES, len(raw))
    db.execute(
        "UPDATE users SET state = ?, updated = ? WHERE id = ?", (raw, int(time.time()), uid)
    )
    db.commit()
    return web.json_response({"ok": True, "friends": friends_of(uid)})


async def config_js(_: web.Request) -> web.Response:
    cfg = {
        "botUsername": BOT_USERNAME,
        "useServer": True,
        "channelUrl": CHANNEL_URL,
        "chatUrl": CHAT_URL,
    }
    return web.Response(
        text=f"window.APP_CONFIG = {json.dumps(cfg)};",
        content_type="application/javascript",
        headers={"Cache-Control": "no-cache"},
    )


async def index(_: web.Request) -> web.FileResponse:
    return web.FileResponse(WEBAPP_DIR / "index.html", headers={"Cache-Control": "no-cache"})


def build_app() -> web.Application:
    app = web.Application(client_max_size=MAX_STATE_BYTES + 10_000)
    app.router.add_post("/api/load", api_load)
    app.router.add_post("/api/save", api_save)
    app.router.add_get("/config.js", config_js)
    app.router.add_get("/", index)
    app.router.add_static("/", WEBAPP_DIR)
    return app


# ---------- Бот ----------


def play_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[[InlineKeyboardButton(text="🐶 Играть", web_app=WebAppInfo(url=WEBAPP_URL))]]
    )


@dp.message(CommandStart())
async def on_start(message: Message, command: CommandObject) -> None:
    u = message.from_user
    register_user(
        u.id,
        u.full_name or u.username or "Игрок",
        bool(u.is_premium),
        parse_ref(command.args),
    )
    await message.answer(
        f"Гав, {u.first_name}! 🐶\n\n"
        "Тапай по собачке, собирай косточки 🦴, прокачивай будку и зови друзей в стаю.\n"
        "Чем выше уровень — тем больше доход даже когда ты не в игре!",
        reply_markup=play_keyboard(),
    )


@dp.message(F.text)
async def on_any(message: Message) -> None:
    await message.answer("Жми кнопку, чтобы открыть игру 👇", reply_markup=play_keyboard())


async def main() -> None:
    global BOT_USERNAME
    if not WEBAPP_URL.startswith("https://"):
        log.warning("WEBAPP_URL должен быть https-адресом, иначе Telegram не откроет мини-апп")

    me = await bot.get_me()
    BOT_USERNAME = me.username or ""
    if WEBAPP_URL:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="Играть", web_app=WebAppInfo(url=WEBAPP_URL))
        )

    runner = web.AppRunner(build_app())
    await runner.setup()
    await web.TCPSite(runner, "0.0.0.0", PORT).start()
    log.info("Сервер запущен на :%s, бот @%s", PORT, BOT_USERNAME)

    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
