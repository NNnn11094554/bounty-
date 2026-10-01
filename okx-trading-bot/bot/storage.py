"""SQLite: все сделки и состояние бота (пауза, дневной лимит), переживает перезапуски."""

from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import fields
from pathlib import Path
from typing import Any

from .models import Trade

SCHEMA = """
CREATE TABLE IF NOT EXISTS trades (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    inst_id         TEXT NOT NULL,
    side            TEXT NOT NULL,
    pos_side        TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open',
    mode            TEXT NOT NULL,
    strategy        TEXT NOT NULL DEFAULT '',
    contracts       REAL NOT NULL,
    ct_val          REAL NOT NULL,
    entry_price     REAL NOT NULL,
    stop_loss       REAL NOT NULL,
    take_profit     REAL,
    initial_stop    REAL NOT NULL,
    atr             REAL NOT NULL DEFAULT 0,
    trail_activation REAL,
    trail_distance  REAL,
    trailing_active INTEGER NOT NULL DEFAULT 0,
    best_price      REAL NOT NULL DEFAULT 0,
    ord_id          TEXT NOT NULL DEFAULT '',
    algo_id         TEXT NOT NULL DEFAULT '',
    algo_cl_id      TEXT NOT NULL DEFAULT '',
    opened_at       INTEGER NOT NULL,
    closed_at       INTEGER,
    exit_price      REAL,
    pnl             REAL,
    fee             REAL,
    close_reason    TEXT NOT NULL DEFAULT '',
    note            TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_closed ON trades(closed_at);
CREATE TABLE IF NOT EXISTS state (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

_TRADE_COLUMNS = [f.name for f in fields(Trade) if f.name not in ("id", "close_checks")]


class Storage:
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("PRAGMA synchronous=NORMAL")
        self._db.executescript(SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._db.close()

    # ---------- сделки ----------

    @staticmethod
    def _row_to_trade(row: sqlite3.Row) -> Trade:
        data = dict(row)
        data["trailing_active"] = bool(data["trailing_active"])
        return Trade(**data)

    def insert_trade(self, trade: Trade) -> int:
        values = [getattr(trade, c) for c in _TRADE_COLUMNS]
        values = [int(v) if isinstance(v, bool) else v for v in values]
        sql = f"INSERT INTO trades ({', '.join(_TRADE_COLUMNS)}) VALUES ({', '.join('?' * len(_TRADE_COLUMNS))})"
        with self._lock:
            cur = self._db.execute(sql, values)
        trade.id = int(cur.lastrowid)
        return trade.id

    def update_trade(self, trade: Trade, *names: str) -> None:
        """Сохранить указанные поля (или все, если не указаны)."""
        if trade.id is None:
            raise ValueError("trade.id is None")
        cols = list(names) or _TRADE_COLUMNS
        values = [getattr(trade, c) for c in cols]
        values = [int(v) if isinstance(v, bool) else v for v in values]
        sql = f"UPDATE trades SET {', '.join(f'{c} = ?' for c in cols)} WHERE id = ?"
        with self._lock:
            self._db.execute(sql, [*values, trade.id])

    def get_trade(self, trade_id: int) -> Trade | None:
        with self._lock:
            row = self._db.execute("SELECT * FROM trades WHERE id = ?", (trade_id,)).fetchone()
        return self._row_to_trade(row) if row else None

    def open_trades(self) -> list[Trade]:
        with self._lock:
            rows = self._db.execute("SELECT * FROM trades WHERE status = 'open' ORDER BY id").fetchall()
        return [self._row_to_trade(r) for r in rows]

    def closed_trades(self, since_ms: int | None = None, until_ms: int | None = None) -> list[Trade]:
        sql = "SELECT * FROM trades WHERE status = 'closed'"
        args: list[Any] = []
        if since_ms is not None:
            sql += " AND closed_at >= ?"
            args.append(since_ms)
        if until_ms is not None:
            sql += " AND closed_at < ?"
            args.append(until_ms)
        sql += " ORDER BY closed_at, id"
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [self._row_to_trade(r) for r in rows]

    def realized_pnl(self, since_ms: int, until_ms: int | None = None) -> float:
        return sum(t.pnl or 0.0 for t in self.closed_trades(since_ms, until_ms))

    # ---------- состояние ----------

    def get_state(self, key: str, default: Any = None) -> Any:
        with self._lock:
            row = self._db.execute("SELECT value FROM state WHERE key = ?", (key,)).fetchone()
        return json.loads(row["value"]) if row else default

    def set_state(self, key: str, value: Any) -> None:
        with self._lock:
            self._db.execute(
                "INSERT INTO state (key, value) VALUES (?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                (key, json.dumps(value)),
            )
