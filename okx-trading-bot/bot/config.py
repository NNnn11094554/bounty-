"""Загрузка настроек: торговые параметры из config.yaml, секреты и режим — из .env."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Literal
from zoneinfo import ZoneInfo

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, field_validator

TIMEFRAME_RE = re.compile(r"^(\d+)([mHD])$")
_UNIT_MS = {"m": 60_000, "H": 3_600_000, "D": 86_400_000}
# бары, границы которых совпадают с границами, отсчитанными от 1970-01-01 UTC
SUPPORTED_TIMEFRAMES = ("1m", "3m", "5m", "15m", "30m", "1H", "2H", "4H", "6H", "12H", "1D")
_TRUE = {"1", "true", "yes", "on"}


def timeframe_to_ms(timeframe: str) -> int:
    """'15m' -> 900000. Поддерживаются: 1m 3m 5m 15m 30m 1H 2H 4H 6H 12H 1D."""
    m = TIMEFRAME_RE.match(timeframe)
    if not m or timeframe not in SUPPORTED_TIMEFRAMES:
        raise ValueError(f"Неверный таймфрейм {timeframe!r}: поддерживаются {', '.join(SUPPORTED_TIMEFRAMES)}")
    return int(m.group(1)) * _UNIT_MS[m.group(2)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExchangeConfig(_Strict):
    symbols: list[str] = Field(default_factory=lambda: ["BTC-USDT-SWAP", "ETH-USDT-SWAP"], min_length=1)
    timeframe: str = "15m"
    leverage: int = Field(3, ge=1, le=125)
    margin_mode: Literal["isolated", "cross"] = "isolated"
    trigger_price_type: Literal["last", "mark", "index"] = "last"
    candles_history: int = Field(600, ge=100, le=1400)
    hostname: str = "www.okx.com"
    request_timeout_sec: float = Field(15, gt=0)
    ws_url_demo: str = "wss://wspap.okx.com:8443/ws/v5/public"
    ws_url_live: str = "wss://ws.okx.com:8443/ws/v5/public"

    @field_validator("symbols")
    @classmethod
    def _check_symbols(cls, v: list[str]) -> list[str]:
        out = []
        for s in v:
            s = s.strip().upper()
            if not s.endswith("-USDT-SWAP"):
                raise ValueError(f"{s}: поддерживаются только USDT-M бессрочные свопы вида BTC-USDT-SWAP")
            if s not in out:
                out.append(s)
        return out

    @field_validator("timeframe")
    @classmethod
    def _check_tf(cls, v: str) -> str:
        timeframe_to_ms(v)
        return v

    @property
    def timeframe_ms(self) -> int:
        return timeframe_to_ms(self.timeframe)


class StrategyConfig(_Strict):
    name: str = "ema_cross"
    params: dict[str, Any] = Field(default_factory=dict)


class RiskConfig(_Strict):
    risk_per_trade_pct: float = Field(1.0, gt=0, le=10)
    max_open_positions: int = Field(2, ge=1, le=50)
    daily_loss_limit_pct: float = Field(5.0, gt=0, le=100)
    max_margin_usage_pct: float = Field(90.0, gt=0, le=100)
    taker_fee_pct: float = Field(0.05, ge=0, le=1)
    close_on_opposite_signal: bool = False
    day_reset_timezone: str = "UTC"

    @field_validator("day_reset_timezone")
    @classmethod
    def _check_tz(cls, v: str) -> str:
        ZoneInfo(v)
        return v


class TradingConfig(_Strict):
    loop_interval_sec: float = Field(5, gt=0)
    reconcile_interval_sec: float = Field(30, gt=0)
    candle_close_delay_sec: float = Field(3, ge=0)
    signal_max_delay_sec: float = Field(120, gt=0)
    trailing_min_step_atr: float = Field(0.1, ge=0)
    price_stale_sec: float = Field(15, gt=0)
    watchdog_timeout_sec: float = Field(600, ge=120)


class BacktestConfig(_Strict):
    months: float = Field(6, gt=0, le=36)
    initial_balance: float = Field(1000, gt=0)
    taker_fee_pct: float = Field(0.05, ge=0)
    slippage_pct: float = Field(0.02, ge=0)
    funding_rate_8h_pct: float = Field(0.01, ge=0)
    reports_dir: str = "reports"
    cache_dir: str = "data/history"


class LoggingConfig(_Strict):
    level: str = "INFO"
    file: str = "logs/bot.log"
    max_bytes: int = Field(10 * 1024 * 1024, gt=0)
    backup_count: int = Field(10, ge=1)


class Secrets(BaseModel):
    okx_api_key: str = ""
    okx_api_secret: str = ""
    okx_api_passphrase: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: int | None = None
    live_trading: bool = False

    @property
    def has_okx_keys(self) -> bool:
        return bool(self.okx_api_key and self.okx_api_secret and self.okx_api_passphrase)

    @property
    def telegram_enabled(self) -> bool:
        return bool(self.telegram_bot_token and self.telegram_chat_id)

    def values_to_redact(self) -> list[str]:
        return [v for v in (self.okx_api_key, self.okx_api_secret, self.okx_api_passphrase,
                            self.telegram_bot_token) if v and len(v) >= 6]


class Settings(_Strict):
    exchange: ExchangeConfig = Field(default_factory=ExchangeConfig)
    strategy: StrategyConfig = Field(default_factory=StrategyConfig)
    risk: RiskConfig = Field(default_factory=RiskConfig)
    trading: TradingConfig = Field(default_factory=TradingConfig)
    backtest: BacktestConfig = Field(default_factory=BacktestConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)
    database_path: str = "data/bot.db"
    secrets: Secrets = Field(default_factory=Secrets)

    @property
    def demo(self) -> bool:
        return not self.secrets.live_trading

    @property
    def mode(self) -> str:
        return "DEMO" if self.demo else "LIVE"

    @property
    def ws_url(self) -> str:
        return self.exchange.ws_url_demo if self.demo else self.exchange.ws_url_live


def _env_bool(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in _TRUE


def secrets_from_env() -> Secrets:
    chat = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    try:
        chat_id = int(chat) if chat else None
    except ValueError as exc:
        raise ValueError("TELEGRAM_CHAT_ID должен быть числом (например 123456789)") from exc
    return Secrets(
        okx_api_key=os.environ.get("OKX_API_KEY", "").strip(),
        okx_api_secret=os.environ.get("OKX_API_SECRET", "").strip(),
        okx_api_passphrase=os.environ.get("OKX_API_PASSPHRASE", "").strip(),
        telegram_bot_token=os.environ.get("TELEGRAM_BOT_TOKEN", "").strip(),
        telegram_chat_id=chat_id,
        # LIVE включается только явным LIVE_TRADING=true, всё остальное — DEMO
        live_trading=_env_bool("LIVE_TRADING"),
    )


def load_settings(config_path: str | os.PathLike | None = None, env_file: str | None = ".env") -> Settings:
    if env_file and Path(env_file).exists():
        load_dotenv(env_file, override=False)
    path = Path(config_path or os.environ.get("CONFIG_PATH", "config.yaml"))
    raw: dict[str, Any] = {}
    if path.exists():
        with path.open(encoding="utf-8") as fh:
            raw = yaml.safe_load(fh) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path}: ожидался YAML-словарь")
    raw.pop("secrets", None)  # секреты в config.yaml не принимаем
    return Settings(**raw, secrets=secrets_from_env())
