import type { User } from '@prisma/client';
import { env } from '../env.js';
import { REFERRAL } from '../game/config/rewards.js';
import { prisma } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { applyBalanceChanges, onLeagueUp } from './ledger.js';
import { enqueueNotification } from './notifications.js';
import { lockUser, withUserLock } from './userLock.js';
import { checkAchievements } from './achievements.js';

const REF_RE = /^ref_(\d{1,20})$/;

/** Telegram ID пригласившего из start_param вида ref_<telegramId>. */
export function parseReferral(startParam: string | null | undefined): bigint | null {
  const match = startParam ? REF_RE.exec(startParam) : null;
  return match ? BigInt(match[1]!) : null;
}

/**
 * Реферальная ссылка на бота: t.me/<бот>?start=ref_<telegramId>. Работает без регистрации Mini App в BotFather:
 * друг жмёт Start, бот запоминает приглашение (PendingReferral), игра засчитывает его при первом входе.
 * Ссылка вида t.me/<бот>/<app>?startapp=ref_… тоже поддерживается (start_param в initData).
 */
export function referralLink(telegramId: bigint): string {
  return `https://t.me/${env.BOT_USERNAME}?start=ref_${telegramId}`;
}

/** Приглашение из /start действует столько дней — потом друг считается пришедшим сам. */
const PENDING_TTL_MS = 7 * 24 * 3_600_000;

/**
 * Друг нажал Start по реферальной ссылке. Запоминаем пригласившего, если друга ещё нет в игре.
 * Первое приглашение не перезаписывается другим (кроме просроченного).
 */
export async function rememberPendingReferral(telegramId: bigint, payload: string): Promise<boolean> {
  const inviterTelegramId = parseReferral(payload);
  if (inviterTelegramId === null || inviterTelegramId === telegramId) return false;
  if (await prisma.user.findUnique({ where: { telegramId }, select: { id: true } })) return false;
  const existing = await prisma.pendingReferral.findUnique({ where: { telegramId } });
  if (existing && Date.now() - existing.createdAt.getTime() < PENDING_TTL_MS) return false;
  await prisma.pendingReferral.upsert({
    where: { telegramId },
    create: { telegramId, inviterTelegramId },
    update: { inviterTelegramId, createdAt: new Date() },
  });
  return true;
}

/** Приглашение для нового игрока: из start_param или запомненное ботом. Запомненное удаляется. */
export async function referralForNewPlayer(
  invitee: User,
  startParam: string | null,
): Promise<ReferralResult | null> {
  const direct = parseReferral(startParam);
  const pending = await prisma.pendingReferral.findUnique({ where: { telegramId: invitee.telegramId } });
  if (pending)
    await prisma.pendingReferral.delete({ where: { telegramId: invitee.telegramId } }).catch(() => null);
  const fresh = pending && Date.now() - pending.createdAt.getTime() < PENDING_TTL_MS;
  const inviterTgId = direct ?? (fresh ? pending.inviterTelegramId : null);
  return inviterTgId === null ? null : applyReferral(invitee, `ref_${inviterTgId}`);
}

export interface ReferralResult {
  inviterName: string;
  bonus: number;
}

/**
 * Засчитать приглашение при ПЕРВОМ входе игрока: бонус обоим (+5 000, с Premium — +25 000).
 * Нельзя пригласить себя; заблокированный пригласивший бонусов не получает.
 */
export async function applyReferral(
  invitee: User,
  startParam: string | null,
): Promise<ReferralResult | null> {
  const inviterTgId = parseReferral(startParam);
  if (inviterTgId === null || inviterTgId === invitee.telegramId) return null;
  // игрок уже был в игре и удалил аккаунт — повторное приглашение бонусов не даёт
  if (await prisma.deletedUser.findUnique({ where: { telegramId: invitee.telegramId } })) return null;
  const inviter = await prisma.user.findUnique({ where: { telegramId: inviterTgId } });
  if (!inviter || inviter.isBanned || inviter.id === invitee.id || inviter.createdAt > invitee.createdAt)
    return null;
  const bonus = invitee.isPremium ? REFERRAL.premium : REFERRAL.regular;
  const now = new Date();

  return withUserLock(invitee.id, async (tx, lockedInvitee) => {
    if (lockedInvitee.referrerId !== null) return null;
    if (await tx.referral.findUnique({ where: { inviteeId: invitee.id } })) return null;
    await tx.referral.create({
      data: {
        inviterId: inviter.id,
        inviteeId: invitee.id,
        isPremium: invitee.isPremium,
        bonusGiven: BigInt(bonus),
        inviterEarned: BigInt(bonus),
      },
    });
    // бонус другу (может поднять его лигу — тогда пригласивший сразу получит и бонус за лигу)
    await applyBalanceChanges(
      tx,
      lockedInvitee,
      [{ type: 'referral_bonus', amount: bonus, meta: { inviterId: inviter.id } }],
      { referrer: { connect: { id: inviter.id } } },
      now,
    );
    const lockedInviter = await lockUser(tx, inviter.id);
    if (lockedInviter) {
      const credited = await applyBalanceChanges(
        tx,
        lockedInviter,
        [{ type: 'referral_bonus', amount: bonus, meta: { inviteeId: invitee.id } }],
        {},
        now,
      );
      await checkAchievements(tx, credited, now, ['friends', 'premiumFriends']);
    }
    await enqueueNotification(tx, inviter.id, 'friend_joined', {
      name: invitee.firstName || invitee.username || '🐾',
      bonus,
    });
    logger.info({ inviterId: inviter.id, inviteeId: invitee.id, bonus }, 'referral registered');
    return { inviterName: inviter.firstName || inviter.username || 'Player', bonus };
  });
}

/** Бонусы пригласившему за лиги, которых достиг друг (каждая лига — один раз). */
export function leagueBonus(levels: readonly number[], premium: boolean): number {
  const mult = premium ? REFERRAL.premiumMultiplier : 1;
  return levels.reduce((sum, level) => sum + (REFERRAL.leagues[level] ?? 0) * mult, 0);
}

onLeagueUp(async (tx, user, from, to) => {
  const ref = await tx.referral.findUnique({ where: { inviteeId: user.id } });
  if (!ref) return;
  const levels: number[] = [];
  for (let level = from + 1; level <= to; level++) {
    if (REFERRAL.leagues[level] && !ref.leagueBonusesGiven.includes(level)) levels.push(level);
  }
  if (levels.length === 0) return;
  const amount = leagueBonus(levels, ref.isPremium);
  const inviter = await lockUser(tx, ref.inviterId);
  // заблокированный пригласивший бонусов не получает, но лиги отмечаются — повторно не начислятся
  await tx.referral.update({
    where: { id: ref.id },
    data: {
      leagueBonusesGiven: [...ref.leagueBonusesGiven, ...levels],
      ...(inviter && !inviter.isBanned ? { inviterEarned: { increment: BigInt(amount) } } : {}),
    },
  });
  if (!inviter || inviter.isBanned) return;
  await applyBalanceChanges(
    tx,
    inviter,
    [{ type: 'referral_league_bonus', amount, meta: { inviteeId: user.id, levels } }],
    {},
    new Date(),
  );
});
