import { formatInt, formatShort, type FriendEntry } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { DURATION, isReducedMotion } from '../../animations';
import { Avatar } from '../../components/Avatar';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon } from '../../components/icons';
import { PullToRefresh } from '../../components/PullToRefresh';
import { copyText } from '../../lib/clipboard';
import { useLocale, useT } from '../../i18n';
import { useFriends } from '../../store/friends';
import { useGame } from '../../store/game';
import { toast } from '../../store/toasts';
import { haptic, openLink } from '../../telegram/webapp';

function GiftRow({ premium, amount }: { premium?: boolean; amount: number }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-line bg-night-700 p-3 shadow-card">
      <CardIcon icon={premium ? 'gift/star/2' : 'gift/heart/6'} size={52} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold">
          {t(premium ? 'friends.invitePremium' : 'friends.invite')}
        </p>
        <p className="flex flex-wrap items-center gap-1 text-sm font-extrabold">
          <CoinIcon size={16} />
          <span className="text-gold">+{formatInt(amount)}</span>
          <span className="font-bold text-white/55">{t('friends.inviteBoth')}</span>
        </p>
      </div>
    </div>
  );
}

function FriendRow({ friend, index }: { friend: FriendEntry; index: number }) {
  const locale = useLocale();
  const leagues = useGame((s) => s.config?.leagues ?? []);
  const league = leagues[friend.leagueLevel];
  const color = league?.color === 'rainbow' ? '#ffc93c' : league?.color;
  return (
    <motion.li
      initial={isReducedMotion() ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * (DURATION.stagger / 1000), duration: 0.25 }}
      className="flex items-center gap-3 rounded-2xl bg-night-700/80 px-3 py-2.5"
      data-testid="friend-row"
    >
      <Avatar name={friend.name} photoUrl={friend.photoUrl} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold">
          {friend.name}
          {friend.isPremium && <span className="ml-1 text-gold">★</span>}
        </p>
        <p className="flex items-center gap-1 text-xs font-bold text-white/55">
          <span style={{ color }}>{league?.name}</span>
          <span>•</span>
          <CoinIcon size={12} />
          {formatShort(friend.balance, locale)}
        </p>
      </div>
      <span className="flex items-center gap-1 text-sm font-black text-gold" data-testid="friend-bonus">
        <CoinIcon size={16} />+{formatShort(friend.bonus, locale)}
      </span>
    </motion.li>
  );
}

function BonusesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const data = useFriends((s) => s.data);
  const leagues = useGame((s) => s.config?.leagues ?? []);
  return (
    <BottomSheet open={open} onClose={onClose} testId="friends-bonuses">
      {data && (
        <div className="flex flex-col gap-3 pt-1">
          <h3 className="text-xl font-black">{t('friends.bonusesTitle')}</h3>
          <p className="text-sm font-semibold leading-snug text-white/70">{t('friends.bonusesText')}</p>
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 bg-night-600 px-3 py-2 text-xs font-extrabold text-white/55">
              <span>{t('friends.league')}</span>
              <span className="w-16 text-right">{t('friends.regular')}</span>
              <span className="w-16 text-right">{t('friends.premium')}</span>
            </div>
            {[
              {
                key: 'invite',
                label: t('friends.forFriend'),
                color: '#fff',
                regular: data.bonuses.regular,
                premium: data.bonuses.premium,
              },
              ...data.bonuses.leagues.map((b) => {
                const league = leagues[b.level];
                return {
                  key: String(b.level),
                  label: league?.name ?? String(b.level + 1),
                  color: league?.color === 'rainbow' ? '#ffc93c' : (league?.color ?? '#fff'),
                  regular: b.regular,
                  premium: b.premium,
                };
              }),
            ].map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-line px-3 py-2 text-sm font-extrabold"
              >
                <span className="flex items-center gap-2" style={{ color: row.color }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
                  {row.label}
                </span>
                <span className="w-16 text-right text-gold">+{formatShort(row.regular, locale)}</span>
                <span className="w-16 text-right text-gold">+{formatShort(row.premium, locale)}</span>
              </div>
            ))}
          </div>
          <Button block className="mt-1" onClick={onClose}>
            {t('common.ok')}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}

/** Экран Friends: бонусы за приглашения, список друзей, ссылка-приглашение. */
export function FriendsScreen() {
  const t = useT();
  const data = useFriends((s) => s.data);
  const friends = useFriends((s) => s.friends);
  const nextCursor = useFriends((s) => s.nextCursor);
  const status = useFriends((s) => s.status);
  const loadingMore = useFriends((s) => s.loadingMore);
  const load = useFriends((s) => s.load);
  const loadMore = useFriends((s) => s.loadMore);
  const [bonusesOpen, setBonusesOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const invite = () => {
    if (!data) return;
    haptic.impact('medium');
    const text = t('friends.shareText', { bonus: formatInt(data.bonuses.regular) });
    openLink(`https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent(text)}`);
  };
  const copy = async () => {
    if (!data) return;
    if (await copyText(data.link)) {
      haptic.notify('success');
      toast.success(t('friends.copied'));
    } else {
      toast.error(t('friends.copyFailed', { link: data.link }));
    }
  };

  return (
    <div className="relative h-full" data-testid="friends">
      <PullToRefresh className="h-full px-4 pb-28" onRefresh={() => load(true)} testId="friends-scroll">
        <div className="flex flex-col items-center pt-6 text-center">
          <h1 className="text-[28px] font-black leading-tight">{t('friends.title')}</h1>
          <p className="mt-1 text-[15px] font-semibold text-white/60">{t('friends.subtitle')}</p>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <GiftRow amount={data?.bonuses.regular ?? 5000} />
          <GiftRow premium amount={data?.bonuses.premium ?? 25000} />
        </div>
        <button
          type="button"
          onClick={() => setBonusesOpen(true)}
          className="mx-auto mt-3 block text-sm font-extrabold text-violet underline-offset-2 active:underline"
          data-testid="friends-more"
        >
          {t('friends.more')}
        </button>

        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-[15px] font-extrabold" data-testid="friends-count">
            {t('friends.list', { n: data?.total ?? 0 })}
          </h2>
          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            onClick={() => void refresh()}
            aria-label={t('friends.refresh')}
            className="grid h-9 w-9 place-items-center rounded-full bg-night-700 text-white/70"
            data-testid="friends-refresh"
          >
            <motion.svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0 }}
              aria-hidden
            >
              <path
                d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          </motion.button>
        </div>
        {data && data.earned > 0 && (
          <p
            className="mt-1 flex items-center gap-1 text-xs font-bold text-white/55"
            data-testid="friends-earned"
          >
            <CoinIcon size={13} />
            {t('friends.earned', { value: formatInt(data.earned) })}
          </p>
        )}

        <div className="mt-3">
          {status === 'error' && !data ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-[15px] font-bold text-white/70">{t('friends.error')}</p>
              <Button variant="secondary" onClick={() => void load(true)}>
                {t('common.retry')}
              </Button>
            </div>
          ) : !data ? (
            <ul className="flex flex-col gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <li key={i} className="flex items-center gap-3 rounded-2xl bg-night-700/80 px-3 py-2.5">
                  <span className="skeleton h-10 w-10 rounded-full" />
                  <span className="flex flex-1 flex-col gap-1.5">
                    <span className="skeleton h-3.5 w-2/3 rounded" />
                    <span className="skeleton h-3 w-1/3 rounded" />
                  </span>
                </li>
              ))}
            </ul>
          ) : friends.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-white/15 px-4 py-6 text-center">
              <CardIcon icon="people/heart/2" size={56} />
              <p className="max-w-[280px] text-sm font-bold text-white/60" data-testid="friends-empty">
                {t('friends.empty')}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {friends.map((friend, i) => (
                <FriendRow key={friend.id} friend={friend} index={i} />
              ))}
            </ul>
          )}
          {nextCursor !== null && (
            <Button
              variant="secondary"
              block
              className="mt-3"
              loading={loadingMore}
              onClick={() => void loadMore().catch(() => toast.error(t('friends.error')))}
              data-testid="friends-more-list"
            >
              {t('friends.loadMore')}
            </Button>
          )}
        </div>
      </PullToRefresh>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-900 via-night-900/90 to-transparent px-4 pb-3 pt-8">
        <div className="pointer-events-auto flex gap-2.5">
          <Button
            className="h-14 flex-1 text-base"
            onClick={invite}
            disabled={!data}
            data-testid="friends-invite"
          >
            {t('friends.invite')}
          </Button>
          <Button
            variant="secondary"
            className="h-14 w-14 shrink-0 px-0"
            onClick={() => void copy()}
            disabled={!data}
            aria-label={t('friends.copy')}
            data-testid="friends-copy"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
              <rect
                x="8"
                y="8"
                width="12"
                height="12"
                rx="3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              />
              <path
                d="M16 5.5A2.5 2.5 0 0 0 13.5 3H6a3 3 0 0 0-3 3v7.5A2.5 2.5 0 0 0 5.5 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </Button>
        </div>
      </div>

      <BonusesSheet open={bonusesOpen} onClose={() => setBonusesOpen(false)} />
    </div>
  );
}
