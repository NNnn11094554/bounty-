import {
  VISIBLE_ACHIEVEMENTS,
  ACHIEVEMENT_GROUPS,
  cosmeticById,
  formatInt,
  formatShort,
  MAX_LEVEL,
  playerLevel,
  type Achievement,
  type ProfileStats,
} from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { CardIcon } from '../../components/cards/CardIcon';
import { HeroBust } from '../../components/hero/HeroFigure';
import { CupIcon, GearIcon } from '../../components/icons';
import { LeagueAvatar } from '../../components/LeagueAvatar';
import { leagueAt } from '../../game/leagues';
import { tapEngine } from '../../game/tapEngine';
import { useNow } from '../../hooks/useNow';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { useGame } from '../../store/game';
import { useNav } from '../../store/nav';
import { useProfile } from '../../store/profile';
import { AchievementSheet } from './AchievementSheet';

const STATS: ReadonlyArray<{ key: MessageKey; field: keyof ProfileStats; short?: boolean }> = [
  { key: 'profile.stat.taps', field: 'totalTaps' },
  { key: 'profile.stat.earned', field: 'totalEarned', short: true },
  { key: 'profile.stat.days', field: 'daysPlayed' },
  { key: 'profile.stat.streak', field: 'bestDailyStreak' },
  { key: 'profile.stat.friends', field: 'friends' },
  { key: 'profile.stat.cards', field: 'cards' },
  { key: 'profile.stat.combos', field: 'combos' },
  { key: 'profile.stat.ciphers', field: 'ciphers' },
];

/** Профиль игрока: карточка, статистика и все достижения с прогрессом. */
export function ProfileScreen() {
  const t = useT();
  const locale = useLocale();
  const player = useGame((s) => s.player);
  const config = useGame((s) => s.config);
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const { data, status, load } = useProfile();
  useNow(2000); // уровень растёт от тапов и дохода
  const unlockedCount = player?.achievements.unlocked ?? 0;
  const [open, setOpen] = useState<Achievement | null>(null);

  // перезагружаем при открытии и когда появляются новые достижения
  useEffect(() => {
    void load();
  }, [load, unlockedCount]);

  const unlockedAt = useMemo(
    () => new Map((data?.achievements ?? []).map((a) => [a.id, a.unlockedAt])),
    [data],
  );

  if (!player || !config) return null;
  const league = leagueAt(config.leagues, player.leagueLevel);
  const level = playerLevel(tapEngine.totalEarnedNow());
  const skin = cosmeticById(player.cosmetics.skin);
  const total = player.achievements.total;
  const since = new Date(player.profile.createdAt).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="h-full overflow-y-auto px-4 pb-8 pt-4" data-testid="profile">
      <section className="relative overflow-hidden rounded-[24px] border border-line bg-night-700 p-4 shadow-card">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full opacity-30 blur-2xl"
          style={{ background: league.color === 'rainbow' ? '#ffc93c' : league.color }}
        />
        <div className="relative flex items-center gap-3">
          <Avatar name={player.profile.firstName} photoUrl={player.profile.photoUrl} size={64} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-lg font-black" data-testid="profile-name">
              <span className="truncate">{player.profile.firstName}</span>
              {player.profile.isPremium && <span className="text-gold">★</span>}
            </p>
            {player.profile.username && (
              <p className="truncate text-sm font-bold text-white/50">@{player.profile.username}</p>
            )}
            <p className="mt-0.5 text-xs font-bold text-white/45">{t('profile.since', { date: since })}</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.9, rotate: 30 }}
            onClick={() => push('settings')}
            aria-label={t('profile.settings')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-night-600 text-white/80 shadow-card"
            data-testid="open-settings"
          >
            <GearIcon size={22} />
          </motion.button>
        </div>
        <div className="relative mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => push('leagues')}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-night-900/60 px-3 py-2 text-left"
          >
            <LeagueAvatar league={league} size={32} />
            <span className="truncate text-sm font-extrabold">{league.name}</span>
          </button>
        </div>
      </section>

      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        onClick={() => setTab('collection')}
        className="mt-3 flex w-full items-center gap-3 rounded-[22px] border border-[#ff4fd8]/30 bg-gradient-to-br from-[#ff4fd8]/12 to-night-700 p-3 text-left shadow-card"
        data-testid="profile-level"
      >
        <HeroBust skinId={player.cosmetics.skin} size={56} className="shrink-0 rounded-2xl" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="text-[17px] font-black" data-testid="profile-level-value">
              {t('profile.level', { level: level.level })}
            </span>
            <span className="truncate text-xs font-bold text-white/50">{skin?.name[locale]}</span>
          </span>
          <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-[#ff4fd8] to-[#7a5cff]"
              style={{ width: `${Math.round(level.progress * 100)}%` }}
            />
          </span>
          <span className="mt-1 block text-xs font-bold text-white/50">
            {level.level >= MAX_LEVEL
              ? t('profile.maxLevel')
              : t('profile.nextLevel', {
                  level: level.level + 1,
                  value: formatShort(Math.max(0, level.span - level.current), locale),
                })}
          </span>
        </span>
      </motion.button>

      <h2 className="mb-2 mt-6 text-[15px] font-extrabold">{t('profile.stats')}</h2>
      <div className="grid grid-cols-2 gap-2" data-testid="profile-stats">
        {/* профиль открывают часто: плитки без каскада появления — экран и так проявляется целиком */}
        {STATS.map((s) => (
          <div key={s.key} className="rounded-2xl border border-line bg-night-700/80 px-3 py-2.5 shadow-card">
            <p className="truncate text-xs font-bold text-white/50">{t(s.key)}</p>
            {data ? (
              <p className="mt-0.5 text-lg font-black tabular" data-testid={`stat-${s.field}`}>
                {s.short ? formatShort(data.stats[s.field], locale) : formatInt(data.stats[s.field])}
              </p>
            ) : (
              <div className="skeleton mt-1.5 h-5 w-16 rounded-lg" />
            )}
          </div>
        ))}
      </div>

      <div className="mb-2 mt-6 flex items-center gap-2">
        <CupIcon size={22} />
        <h2 className="flex-1 text-[15px] font-extrabold">{t('achievements.title')}</h2>
        <span className="text-sm font-extrabold text-gold" data-testid="achievements-count">
          {t('achievements.count', { n: unlockedCount, total })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full origin-left rounded-full bg-progress transition-transform duration-700"
          style={{ transform: `scaleX(${total ? unlockedCount / total : 0})` }}
        />
      </div>

      {status === 'error' && !data ? (
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 w-full rounded-2xl bg-night-700 p-4 text-sm font-bold text-white/70"
        >
          {t('common.retry')}
        </button>
      ) : (
        ACHIEVEMENT_GROUPS.map((group) => {
          const items = VISIBLE_ACHIEVEMENTS.filter((a) => a.group === group);
          return (
            <section key={group} className="cv-auto mt-4">
              <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-white/45">
                {t(`achievements.group.${group}` as MessageKey)}
              </h3>
              <div className="grid grid-cols-4 gap-2 narrow:grid-cols-3">
                {items.map((a) => {
                  const done = Boolean(unlockedAt.get(a.id));
                  return (
                    // нажатие — CSS (.press): десятки кнопок без отдельной JS-анимации на каждую
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setOpen(a)}
                      className={`press flex min-w-0 flex-col items-center gap-1 rounded-2xl p-1.5 ${
                        done ? 'bg-gold/10' : ''
                      }`}
                      data-testid={`achievement-${a.id}`}
                      data-unlocked={done}
                    >
                      {data ? (
                        <CardIcon icon={a.icon} size={52} muted={!done} />
                      ) : (
                        <div className="skeleton h-[52px] w-[52px] rounded-[14px]" />
                      )}
                      <span
                        className={`line-clamp-2 text-center text-[11px] font-bold leading-tight ${
                          done ? 'text-white' : 'text-white/45'
                        }`}
                      >
                        {a.name[locale]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      <AchievementSheet
        achievement={open}
        unlockedAt={open ? (unlockedAt.get(open.id) ?? null) : null}
        value={open ? (data?.progress[open.metric] ?? 0) : 0}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
