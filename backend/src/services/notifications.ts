import { formatInt } from '@meowgul/shared';
import type { Prisma, User } from '@prisma/client';
import { BOT_TEXTS, botLocale } from '../bot/texts.js';
import { env } from '../env.js';
import { maxEnergy } from '../game/config/game.js';
import { dayKey } from '../game/dayKey.js';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { processBroadcasts } from './broadcasts.js';
import { nextHappyHour } from './events.js';
import { getAppSettings } from './settings.js';
import { parseSettings } from './state.js';
import { TelegramSendError, telegram, type TelegramGateway } from './telegram.js';
import type { Tx } from './userLock.js';

/**
 * Уведомления бота (только с согласия): очередь в таблице Notification, не больше 2 в игровой день
 * на игрока и не быстрее 25 сообщений в секунду (лимит Telegram — 30).
 */
export type NotificationKind = 'energy_full' | 'friend_joined' | 'daily_combo' | 'happy_hour';

export const NOTIFY = {
  perDay: 2,
  perSecond: 25,
  /** уведомление, пролежавшее в очереди дольше, уже неактуально */
  maxAgeMs: 6 * 3600_000,
  /** «новое комбо» получают игроки, заходившие за последние N дней */
  comboAudienceDays: 3,
} as const;

type Db = Tx | typeof prisma;

export async function enqueueNotification(
  db: Db,
  userId: number,
  kind: NotificationKind,
  payload: Prisma.InputJsonValue = {},
): Promise<void> {
  await db.notification.create({ data: { userId, kind, payload } });
}

/** Согласие игрока: разрешил боту писать и не выключил уведомления в настройках. */
export function canNotify(user: Pick<User, 'allowsWriteToPm' | 'settings' | 'isBanned'>): boolean {
  return user.allowsWriteToPm && !user.isBanned && parseSettings(user.settings).notifications;
}

function render(kind: string, payload: Prisma.JsonValue, user: User): string | null {
  const locale = parseSettings(user.settings).language ?? botLocale(user.languageCode);
  const t = BOT_TEXTS[locale];
  const data = (payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}) as Record<
    string,
    unknown
  >;
  switch (kind) {
    case 'energy_full':
      return t.energyFull;
    case 'friend_joined':
      return t.friendJoined(String(data.name ?? '🐾'), formatInt(Number(data.bonus ?? 0)));
    case 'daily_combo':
      return t.dailyCombo;
    case 'happy_hour':
      return t.happyHour(
        Number(data.multiplier ?? 2),
        Number(data.endsAt ? Date.parse(String(data.endsAt)) : 0),
      );
    default:
      return null;
  }
}

export interface QueueResult {
  sent: number;
  skipped: number;
  failed: number;
  /** Telegram попросил подождать, сек */
  retryAfterSec: number;
}

/** Отправить очередную пачку уведомлений. Несколько процессов не возьмут одно и то же (SKIP LOCKED). */
export async function processNotificationQueue(
  gateway: TelegramGateway = telegram(),
  now: Date = new Date(),
  limit: number = NOTIFY.perSecond,
): Promise<QueueResult> {
  const result: QueueResult = { sent: 0, skipped: 0, failed: 0, retryAfterSec: 0 };
  await prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Notification" WHERE status = 'PENDING' ORDER BY id LIMIT ${limit} FOR UPDATE SKIP LOCKED`;
      if (rows.length === 0) return;
      const items = await tx.notification.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        include: { user: true },
        orderBy: { id: 'asc' },
      });
      const today = dayKey(now);
      // у одного игрока в пачке может быть несколько уведомлений — считаем отправленные по ходу
      const sentByUser = new Map<number, number>();
      for (const n of items) {
        if (result.retryAfterSec > 0) break;
        const user = n.user;
        const sentToday = sentByUser.get(user.id) ?? (user.notifyDayKey === today ? user.notifySentToday : 0);
        const text = render(n.kind, n.payload, user);
        const stale = now.getTime() - n.createdAt.getTime() > NOTIFY.maxAgeMs;
        if (!text || stale || !canNotify(user) || sentToday >= NOTIFY.perDay) {
          await tx.notification.update({ where: { id: n.id }, data: { status: 'SKIPPED' } });
          result.skipped++;
          continue;
        }
        const locale = parseSettings(user.settings).language ?? botLocale(user.languageCode);
        try {
          await gateway.sendMessage(Number(user.telegramId), text, {
            text: BOT_TEXTS[locale].play,
            webApp: env.WEBAPP_URL,
          });
          await tx.notification.update({ where: { id: n.id }, data: { status: 'SENT', sentAt: now } });
          await tx.user.update({
            where: { id: user.id },
            data: { notifyDayKey: today, notifySentToday: sentToday + 1 },
          });
          sentByUser.set(user.id, sentToday + 1);
          result.sent++;
        } catch (err) {
          if (err instanceof TelegramSendError && err.kind === 'rate_limited') {
            result.retryAfterSec = Math.max(1, err.retryAfterSec);
            break; // остаётся в очереди
          }
          const blocked = err instanceof TelegramSendError && err.kind === 'blocked';
          await tx.notification.update({
            where: { id: n.id },
            data: { status: 'FAILED', error: err instanceof Error ? err.message.slice(0, 300) : String(err) },
          });
          // заблокировал бота — больше не пишем, пока снова не откроет его
          if (blocked) await tx.user.update({ where: { id: user.id }, data: { allowsWriteToPm: false } });
          result.failed++;
        }
      }
    },
    { timeout: 30_000 },
  );
  return result;
}

/** «Энергия восстановлена»: игроку, который ушёл с почти пустой энергией и ещё не вернулся. */
export async function scanEnergyReminders(now: Date = new Date(), batch = 500): Promise<number> {
  const users = await prisma.user.findMany({
    where: { energyFullNotify: true },
    take: batch,
    select: {
      id: true,
      energy: true,
      energyUpdatedAt: true,
      energyLimitLevel: true,
      lastSeenAt: true,
      allowsWriteToPm: true,
      settings: true,
      isBanned: true,
    },
  });
  let queued = 0;
  for (const u of users) {
    const missing = Math.max(0, maxEnergy(u.energyLimitLevel) - u.energy);
    const fullAt = u.energyUpdatedAt.getTime() + Math.ceil(missing / 3) * 1000;
    if (fullAt > now.getTime()) continue;
    // игрок заходил после того, как энергия восстановилась, — напоминать незачем
    const away = u.lastSeenAt.getTime() < fullAt - 60_000;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({
        where: { id: u.id, energyFullNotify: true },
        data: { energyFullNotify: false },
      });
      if (claimed.count === 1 && away && canNotify(u)) {
        await enqueueNotification(tx, u.id, 'energy_full');
        queued++;
      }
    });
  }
  return queued;
}

/**
 * Объявление всем недавно активным игрокам с согласием — один раз на marker (день, начало события).
 * Ключ «забирается» атомарно: при нескольких процессах рассылку сделает только один.
 */
async function announceOnce(
  key: string,
  marker: string,
  kind: NotificationKind,
  payload: Prisma.InputJsonValue,
  now: Date,
): Promise<number> {
  await prisma.appSetting.createMany({ data: [{ key, value: '' }], skipDuplicates: true });
  const claimed = await prisma.appSetting.updateMany({
    where: { key, NOT: { value: { equals: marker } } },
    data: { value: marker },
  });
  if (claimed.count === 0) return 0;
  const since = new Date(now.getTime() - NOTIFY.comboAudienceDays * 86_400_000);
  let cursor = 0;
  let total = 0;
  for (;;) {
    const users = await prisma.user.findMany({
      where: { id: { gt: cursor }, lastSeenAt: { gte: since }, allowsWriteToPm: true, isBanned: false },
      select: { id: true, settings: true },
      orderBy: { id: 'asc' },
      take: 1000,
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1]!.id;
    const audience = users.filter((u) => parseSettings(u.settings).notifications);
    if (audience.length) {
      await prisma.notification.createMany({
        data: audience.map((u) => ({ userId: u.id, kind, payload })),
      });
      total += audience.length;
    }
  }
  logger.info({ kind, marker, total }, 'announcement queued');
  return total;
}

/** «Новое комбо дня» — раз в игровой день. */
export async function announceDailyCombo(now: Date = new Date()): Promise<number> {
  const today = dayKey(now);
  return announceOnce('notify.comboDay', today, 'daily_combo', { dayKey: today }, now);
}

/** «Счастливый час начался» — когда начинается очередной счастливый час. */
export async function announceHappyHour(now: Date = new Date()): Promise<number> {
  const hh = nextHappyHour(await getAppSettings(), now);
  if (!hh || hh.startsAt > now.getTime()) return 0;
  const startsAt = new Date(hh.startsAt).toISOString();
  return announceOnce(
    'notify.happyHour',
    startsAt,
    'happy_hour',
    { startsAt, endsAt: new Date(hh.endsAt).toISOString(), multiplier: hh.multiplier },
    now,
  );
}

/**
 * Фоновая работа очереди: раз в секунду — уведомления, затем рассылка из админки в пределах того же
 * лимита 25 сообщений в секунду; напоминания и объявления — раз в минуту.
 */
export function startNotificationWorker(gateway: TelegramGateway = telegram()): () => void {
  let stopped = false;
  let pausedUntil = 0;
  let lastScan = 0;
  let running = false;
  const tick = async () => {
    if (stopped || running || Date.now() < pausedUntil) return;
    running = true;
    try {
      if (Date.now() - lastScan > 60_000) {
        lastScan = Date.now();
        await scanEnergyReminders();
        await announceDailyCombo();
        await announceHappyHour();
      }
      const res = await processNotificationQueue(gateway);
      // остаток лимита секунды — рассылке из админки
      const bc =
        res.retryAfterSec > 0
          ? null
          : await processBroadcasts(gateway, NOTIFY.perSecond - res.sent - res.failed);
      const retry = Math.max(res.retryAfterSec, bc?.retryAfterSec ?? 0);
      if (retry > 0) pausedUntil = Date.now() + retry * 1000;
    } catch (err) {
      logger.error({ err }, 'notification worker failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 1_000);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
