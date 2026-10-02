import { formatInt, formatShort, type TaskView } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { DURATION, isReducedMotion } from '../../animations';
import { Button } from '../../components/Button';
import { CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon } from '../../components/icons';
import { RollingNumber } from '../../components/RollingNumber';
import { TaskIcon } from '../../components/TaskIcon';
import { tapEngine } from '../../game/tapEngine';
import { useLocale, useT } from '../../i18n';
import { useGame } from '../../store/game';
import { useTasks } from '../../store/tasks';
import { haptic } from '../../telegram/webapp';
import { DailyRewardSheet } from './DailyRewardSheet';
import { TaskSheet } from './TaskSheet';

function Check() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-lime text-night-900" aria-label="done">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Arrow() {
  return <span className="text-2xl font-bold leading-none text-white/35">›</span>;
}

function Row({
  icon,
  title,
  subtitle,
  right,
  onClick,
  index,
  testId,
  dim,
}: {
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  right: ReactNode;
  onClick: () => void;
  index: number;
  testId: string;
  dim?: boolean;
}) {
  return (
    <motion.button
      type="button"
      initial={isReducedMotion() ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * (DURATION.stagger / 1000), duration: 0.25 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[20px] border border-line bg-night-700 p-3 text-left shadow-card ${dim ? 'opacity-70' : ''}`}
      data-testid={testId}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold">{title}</span>
        <span className="mt-0.5 flex items-center gap-1 text-sm font-extrabold text-gold">{subtitle}</span>
      </span>
      {right}
    </motion.button>
  );
}

function SpecialCard({ task, onOpen }: { task: TaskView; onOpen: () => void }) {
  const locale = useLocale();
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="relative flex w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-[22px] border border-line bg-night-700 text-left shadow-card"
      data-testid={`special-${task.id}`}
    >
      <div className="relative grid aspect-[16/8] w-full place-items-center bg-gradient-to-br from-violet to-[#3b2bb0]">
        {task.imageUrl ? (
          <img
            src={task.imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <TaskIcon icon={task.icon} size={72} />
        )}
        {task.status === 'done' && (
          <span className="absolute right-2 top-2">
            <Check />
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-[15px] font-extrabold">{task.title[locale]}</p>
        <p className="mt-0.5 flex items-center gap-1 text-sm font-extrabold text-gold">
          <CoinIcon size={16} />+{formatInt(task.reward)}
        </p>
      </div>
    </motion.button>
  );
}

/** Экран Earn: ежедневная награда, спецпредложения и задания. */
export function EarnScreen() {
  const t = useT();
  const locale = useLocale();
  const tasks = useTasks((s) => s.tasks);
  const status = useTasks((s) => s.status);
  const load = useTasks((s) => s.load);
  const daily = useGame((s) => s.player?.daily);
  const rewards = useGame((s) => s.config?.dailyRewards ?? []);
  const [dailyOpen, setDailyOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (id: string) => {
    haptic.impact('light');
    setOpenId(id);
  };
  const special = tasks.filter((x) => x.section === 'SPECIAL');
  const list = tasks.filter((x) => x.section === 'LIST');
  const openTask = openId ? (tasks.find((x) => x.id === openId) ?? null) : null;

  return (
    <div className="h-full overflow-y-auto px-4 pb-6" data-testid="earn">
      <div className="flex flex-col items-center pt-6">
        <div className="breathe relative">
          <div className="absolute inset-[-30%] rounded-full bg-[radial-gradient(circle,rgba(255,201,60,0.45)_0%,transparent_65%)]" />
          <CoinIcon size={96} className="relative" />
        </div>
        <h1 className="mt-4 text-center text-[26px] font-black leading-tight">{t('earn.title')}</h1>
        <div
          className="mt-2 flex items-center gap-1.5 rounded-full border border-line bg-night-700 px-3 py-1"
          data-coin-target
          data-testid="earn-balance"
        >
          <CoinIcon size={18} />
          <RollingNumber getValue={() => tapEngine.balanceNow()} className="text-base font-black" />
        </div>
      </div>

      {special.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[15px] font-extrabold">{t('earn.special')}</h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {special.map((task) => (
              <SpecialCard key={task.id} task={task} onOpen={() => open(task.id)} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-6" data-tour="daily">
        <h2 className="mb-2 text-[15px] font-extrabold">{t('earn.daily')}</h2>
        {daily && (
          <Row
            index={0}
            icon={<CardIcon icon="calendar/star/4" size={48} />}
            title={t('earn.dailyReward')}
            subtitle={
              daily.claimedToday ? (
                <span className="text-white/50">{t('earn.dailyClaimed')}</span>
              ) : (
                <>
                  <CoinIcon size={16} />+{formatShort(rewards[daily.day - 1] ?? 0, locale)}
                </>
              )
            }
            right={
              daily.claimedToday ? (
                <Check />
              ) : (
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-coral-to" />
                  <Arrow />
                </span>
              )
            }
            onClick={() => {
              haptic.impact('light');
              setDailyOpen(true);
            }}
            testId="daily-row"
          />
        )}
      </section>

      <section className="mt-6" data-tour="tasks">
        <h2 className="mb-2 text-[15px] font-extrabold">{t('earn.list')}</h2>
        {status === 'error' && tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-[15px] font-bold text-white/70">{t('earn.error')}</p>
            <Button variant="secondary" onClick={() => void load(true)}>
              {t('common.retry')}
            </Button>
          </div>
        ) : status !== 'ready' && tasks.length === 0 ? (
          <div className="flex flex-col gap-2" data-testid="tasks-skeleton">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-[20px] border border-line bg-night-700 p-3"
              >
                <div className="skeleton h-12 w-12 rounded-[14px]" />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="skeleton h-3.5 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-[15px] font-bold text-white/55" data-testid="tasks-empty">
            {t('earn.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {list.map((task, i) => (
              <Row
                key={task.id}
                index={i + 1}
                icon={<TaskIcon icon={task.icon} size={48} />}
                title={task.title[locale]}
                subtitle={
                  <>
                    <CoinIcon size={16} />+{formatInt(task.reward)}
                  </>
                }
                right={task.status === 'done' ? <Check /> : <Arrow />}
                onClick={() => open(task.id)}
                testId={`task-${task.id}`}
                dim={task.status === 'done'}
              />
            ))}
          </div>
        )}
      </section>

      <DailyRewardSheet open={dailyOpen} onClose={() => setDailyOpen(false)} />
      <TaskSheet task={openTask} onClose={() => setOpenId(null)} />
    </div>
  );
}
