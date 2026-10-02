"""Логи в консоль и в файл с ротацией. Секреты вырезаются из сообщений."""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .config import LoggingConfig

FORMAT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"


class SecretFilter(logging.Filter):
    def __init__(self, secrets: list[str]):
        super().__init__()
        self.secrets = [s for s in secrets if s]

    def filter(self, record: logging.LogRecord) -> bool:
        if not self.secrets:
            return True
        msg = record.getMessage()
        redacted = msg
        for s in self.secrets:
            redacted = redacted.replace(s, "***")
        if redacted != msg:
            record.msg, record.args = redacted, None
        return True


def setup_logging(cfg: LoggingConfig, secrets: list[str] | None = None) -> None:
    root = logging.getLogger()
    root.setLevel(cfg.level.upper())
    for h in list(root.handlers):
        root.removeHandler(h)
    fmt = logging.Formatter(FORMAT)
    secret_filter = SecretFilter(secrets or [])

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    console.addFilter(secret_filter)
    root.addHandler(console)

    if cfg.file:
        Path(cfg.file).parent.mkdir(parents=True, exist_ok=True)
        fh = RotatingFileHandler(cfg.file, maxBytes=cfg.max_bytes, backupCount=cfg.backup_count, encoding="utf-8")
        fh.setFormatter(fmt)
        fh.addFilter(secret_filter)
        root.addHandler(fh)

    # сторонние библиотеки слишком болтливы на INFO
    for noisy in ("httpx", "telegram", "apscheduler", "aiohttp.access", "ccxt"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
