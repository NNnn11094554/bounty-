"""Тексты уведомлений и ответов Telegram (HTML)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, UTC
from html import escape

from .models import InstrumentInfo, Trade
from .stats import TradeStats, fmt_pf

REASONS = {
    "take_profit": "тейк-профит",
    "stop_loss": "стоп-лосс",
    "trailing_stop": "трейлинг-стоп",
    "liquidation": "ЛИКВИДАЦИЯ",
    "adl": "авто-делевередж (ADL)",
    "close_all": "аварийное закрытие /closeall",
    "opposite_signal": "противоположный сигнал",
    "no_protection": "не удалось выставить SL/TP",
    "stop_loss_missing": "SL отсутствовал, цена за стопом",
    "take_profit_missing": "TP отсутствовал, цена за тейком",
    "closed_externally": "закрыта вне бота",
    "end_of_data": "конец данных",
}


def side_label(side: str) -> str:
    return "LONG" if side == "long" else "SHORT"


def coin(inst_id: str) -> str:
    return inst_id.split("-")[0]


def money(v: float | None, signed: bool = False) -> str:
    if v is None:
        return "—"
    return f"{v:+,.2f}" if signed else f"{v:,.2f}"


def duration(ms: int) -> str:
    minutes = max(0, int(ms // 60_000))
    d, rem = divmod(minutes, 1440)
    h, m = divmod(rem, 60)
    if d:
        return f"{d}д {h}ч"
    if h:
        return f"{h}ч {m}м"
    return f"{m}м"


def r_multiple(trade: Trade) -> float | None:
    risk = abs(trade.entry_price - trade.initial_stop) * trade.qty
    if not risk or trade.pnl is None:
        return None
    return trade.pnl / risk


def opened(trade: Trade, inst: InstrumentInfo, mode: str, leverage: int, margin_mode: str,
           risk_amount: float, risk_pct: float, reason: str) -> str:
    emoji = "🟢" if trade.side == "long" else "🔴"
    tp = inst.fmt_price(trade.take_profit) if trade.take_profit else "—"
    notional = trade.qty * trade.entry_price
    return (
        f"{emoji} <b>{side_label(trade.side)} {trade.inst_id}</b> [{mode}]\n"
        f"Вход: <code>{inst.fmt_price(trade.entry_price)}</code> · "
        f"{inst.fmt_size(trade.contracts)} конт. ({trade.qty:g} {coin(trade.inst_id)} ≈ {money(notional)} USDT)\n"
        f"SL: <code>{inst.fmt_price(trade.stop_loss)}</code> · TP: <code>{tp}</code> (на бирже)\n"
        f"Риск: {money(risk_amount)} USDT ({risk_pct:.2f}%) · {leverage}x {margin_mode}\n"
        f"<i>{escape(reason)}</i>"
    )


def closed(trade: Trade, inst: InstrumentInfo | None, mode: str) -> str:
    pnl = trade.pnl or 0.0
    emoji = "✅" if pnl > 0 else "❌"
    fp = inst.fmt_price if inst else (lambda v: f"{v:g}")
    r = r_multiple(trade)
    r_txt = f" ({r:+.2f}R)" if r is not None else ""
    held = duration((trade.closed_at or 0) - trade.opened_at) if trade.closed_at else "—"
    exit_px = fp(trade.exit_price) if trade.exit_price else "—"
    return (
        f"{emoji} <b>Закрыта {side_label(trade.side)} {trade.inst_id}</b> [{mode}] — "
        f"{REASONS.get(trade.close_reason, escape(trade.close_reason or 'закрыта'))}\n"
        f"{fp(trade.entry_price)} → {exit_px} · {held}\n"
        f"PnL: <b>{money(pnl, signed=True)} USDT</b>{r_txt}"
        + (f" · комиссии {money(trade.fee)}" if trade.fee else "")
    )


@dataclass
class PositionView:
    inst_id: str
    side: str
    contracts: float
    entry: float
    mark: float
    upl: float
    stop_loss: float | None = None
    take_profit: float | None = None
    trailing: bool = False
    managed: bool = True


@dataclass
class StatusView:
    mode: str
    state: str
    equity: float
    available: float
    day_pnl: float | None
    day_pnl_pct: float | None
    realized_today: float
    trades_today: int
    daily_limit_pct: float
    positions: list[PositionView] = field(default_factory=list)
    ws_connected: bool | None = None


def status(view: StatusView) -> str:
    lines = [
        f"📊 <b>Статус</b> [{view.mode}] — {view.state}",
        f"Баланс (equity): <b>{money(view.equity)} USDT</b> · свободно {money(view.available)}",
    ]
    if view.day_pnl is not None:
        lines.append(f"PnL за день: <b>{money(view.day_pnl, signed=True)} USDT</b> "
                     f"({view.day_pnl_pct:+.2f}%, лимит −{view.daily_limit_pct:g}%)")
    lines.append(f"Закрыто сегодня: {view.trades_today} сделок, {money(view.realized_today, signed=True)} USDT")
    if view.ws_connected is not None:
        lines.append(f"Цены: {'WebSocket' if view.ws_connected else 'REST (WebSocket переподключается)'}")
    if not view.positions:
        lines.append("Открытых позиций нет")
    for p in view.positions:
        extra = []
        if p.stop_loss:
            extra.append(f"SL {p.stop_loss:g}")
        if p.take_profit:
            extra.append(f"TP {p.take_profit:g}")
        if p.trailing:
            extra.append("трейлинг")
        if not p.managed:
            extra.append("не сопровождается ботом")
        lines.append(
            f"• {side_label(p.side)} {p.inst_id}: {p.contracts:g} конт. @ {p.entry:g}, "
            f"сейчас {p.mark:g}, uPnL <b>{money(p.upl, signed=True)}</b>"
            + (f" ({', '.join(extra)})" if extra else "")
        )
    return "\n".join(lines)


def report(stats: TradeStats, period: str, last: list[Trade]) -> str:
    if stats.trades == 0:
        return f"📈 <b>Отчёт {period}</b>\nЗакрытых сделок пока нет."
    lines = [
        f"📈 <b>Отчёт {period}</b>",
        f"Сделок: {stats.trades} (прибыльных {stats.wins}, убыточных {stats.losses})",
        f"Винрейт: {stats.win_rate:.1f}% · Профит-фактор: {fmt_pf(stats.profit_factor)}",
        f"Итог: <b>{money(stats.net_pnl, signed=True)} USDT</b> · средняя {money(stats.avg_trade, signed=True)}",
        f"Средняя прибыль {money(stats.avg_win, signed=True)} / средний убыток {money(stats.avg_loss, signed=True)}",
        f"Лучшая {money(stats.best, signed=True)} · худшая {money(stats.worst, signed=True)}",
        f"Макс. просадка по закрытым: {money(stats.max_drawdown)} USDT · "
        f"серия убытков: {stats.max_consecutive_losses}",
    ]
    if last:
        lines.append("\nПоследние сделки:")
        for t in last:
            when = datetime.fromtimestamp((t.closed_at or 0) / 1000, tz=UTC).strftime("%d.%m %H:%M")
            lines.append(f"• {when} {side_label(t.side)} {t.inst_id} {money(t.pnl, signed=True)} "
                         f"({REASONS.get(t.close_reason, t.close_reason)})")
    return "\n".join(lines)
