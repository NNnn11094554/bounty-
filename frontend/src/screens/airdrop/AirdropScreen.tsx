import {
  formatInt,
  formatShort,
  TON_WALLET_ENABLED,
  type AirdropRequirement,
  type AirdropRequirementId,
  type AirdropResponse,
} from '@meowgul/shared';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { endpoints } from '../../api/endpoints';
import { Button } from '../../components/Button';
import { CardIcon } from '../../components/cards/CardIcon';
import { CoinIcon } from '../../components/icons';
import { TaskIcon } from '../../components/TaskIcon';
import { useLocale, useT, type MessageKey } from '../../i18n';
import { useGame } from '../../store/game';
import { useTasks } from '../../store/tasks';
import { TaskSheet } from '../earn/TaskSheet';

/** Кошелёк TON и библиотека TON Connect грузятся отдельным модулем — только когда кошелёк включён. */
const WalletSection = TON_WALLET_ENABLED ? lazy(() => import('./WalletCard')) : null;

const REQUIREMENT_ICON: Record<AirdropRequirementId, string> = {
  league: 'medal/sparkle/3',
  level: 'rocket/up/5',
  friends: 'people/star/5',
  streak: 'calendar/fire/1',
  cards: 'briefcase/check/8',
  tasks: 'scroll/check/7',
};

/** Последний ответ — чтобы при повторном открытии вкладки данные были сразу, а свежие подгружались фоном. */
let cached: AirdropResponse | null = null;

function useAirdrop() {
  const [data, setData] = useState<AirdropResponse | null>(cached);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    setFailed(false);
    endpoints
      .airdrop()
      .then((res) => {
        cached = res;
        setData(res);
      })
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);
  return { data, failed, load };
}

function RequirementRow({ req }: { req: AirdropRequirement }) {
  const t = useT();
  const leagues = useGame((s) => s.config?.leagues);
  const name = req.id === 'league' ? (leagues?.[req.target]?.name ?? String(req.target)) : '';
  return (
    <li
      className="flex items-center gap-3 rounded-2xl bg-night-800/70 px-3 py-2.5"
      data-testid={`airdrop-req-${req.id}`}
      data-done={req.done}
    >
      <CardIcon icon={REQUIREMENT_ICON[req.id]} size={38} muted={!req.done} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-extrabold">
          {t(`airdrop.req.${req.id}` as MessageKey, { target: req.target, name })}
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10">
          <span
            className={`block h-full rounded-full ${req.done ? 'bg-lime' : 'bg-gold'}`}
            style={{ width: `${Math.round((req.current / req.target) * 100)}%` }}
          />
        </span>
      </span>
      <span className={`shrink-0 text-sm font-black ${req.done ? 'text-lime' : 'text-white/55'}`}>
        {req.done ? '✓' : `${req.current}/${req.target}`}
      </span>
    </li>
  );
}

function Skeleton() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" data-testid="airdrop-loading">
      <span className="sr-only">{t('common.loading')}</span>
      <div className="skeleton h-[104px] rounded-[22px]" />
      <div className="skeleton h-[260px] rounded-[22px]" />
    </div>
  );
}

/** Карточка «Подключение кошелька — скоро», пока TON_WALLET_ENABLED выключен. Ничего не открывает. */
function WalletSoon() {
  const t = useT();
  return (
    <div
      className="flex items-center gap-3 rounded-[20px] border border-dashed border-white/15 bg-night-700/60 p-3"
      data-testid="airdrop-wallet-soon"
    >
      <CardIcon icon="lock/star/9" size={44} muted />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-extrabold text-white/80">{t('airdrop.walletSoon')}</span>
        <span className="block text-xs font-bold text-white/45">{t('airdrop.walletSoonHint')}</span>
      </span>
      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase text-white/60">
        {t('airdrop.soonBadge')}
      </span>
    </div>
  );
}

/** Вкладка Airdrop: очки, место среди игроков, готовность по требованиям и задания. */
export function AirdropScreen() {
  const t = useT();
  const locale = useLocale();
  const { data, failed, load } = useAirdrop();
  const tasks = useTasks((s) => s.tasks);
  const loadTasks = useTasks((s) => s.load);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);
  const extra = tasks.filter((x) => x.section === 'AIRDROP' && x.type !== 'CONNECT_WALLET');
  const openTask = openId ? (tasks.find((x) => x.id === openId) ?? null) : null;
  const percent = data ? Math.round(data.progress * 100) : 0;

  return (
    <div className="h-full overflow-y-auto px-4 pb-6" data-testid="airdrop">
      <div className="flex flex-col items-center pt-6 text-center">
        {/* неподвижно: экран открывают часто, бесконечное вращение и покачивание только грузили телефон */}
        <div className="relative">
          <div className="absolute inset-[-45%] rounded-full bg-[conic-gradient(from_0deg,transparent,rgba(255,201,60,0.35),transparent_30%,rgba(166,107,255,0.3),transparent_60%)]" />
          <div className="relative rounded-full shadow-glow">
            <CoinIcon size={92} />
          </div>
        </div>
        <h1 className="mt-5 text-[28px] font-black">{t('airdrop.title')}</h1>
        <p className="mt-1.5 max-w-[320px] text-[15px] font-semibold leading-snug text-white/65">
          {t('airdrop.text')}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {failed && !data ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center" data-testid="airdrop-error">
            <p className="text-[15px] font-bold text-white/70">{t('airdrop.error')}</p>
            <Button variant="secondary" onClick={load} data-testid="airdrop-retry">
              {t('common.retry')}
            </Button>
          </div>
        ) : !data ? (
          <Skeleton />
        ) : (
          <>
            <div
              className="flex items-center gap-3 rounded-[22px] border border-gold/30 bg-gradient-to-br from-gold/15 to-night-700 p-4 shadow-card"
              data-tour="points"
            >
              <CoinIcon size={44} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black uppercase tracking-wide text-white/55">
                  {t('airdrop.points')}
                </p>
                <p className="truncate text-[26px] font-black leading-tight" data-testid="airdrop-points">
                  {formatInt(data.points)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-black uppercase tracking-wide text-white/55">
                  {t('airdrop.rank')}
                </p>
                <p className="text-[20px] font-black text-gold" data-testid="airdrop-rank">
                  #{formatShort(data.rank, locale)}
                </p>
                <p className="text-[11px] font-bold text-white/45">
                  {t('airdrop.ofPlayers', { count: formatShort(data.players, locale) })}
                </p>
              </div>
            </div>

            <div className="rounded-[22px] border border-line bg-night-700 p-3 shadow-card">
              <div className="flex items-baseline justify-between px-1">
                <p className="text-[15px] font-extrabold">{t('airdrop.readiness')}</p>
                <p className="text-[15px] font-black text-gold" data-testid="airdrop-progress">
                  {percent}%
                </p>
              </div>
              <div className="mx-1 mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                {/* полоса — transform, а не width: без пересчёта раскладки */}
                <div
                  className="h-full origin-left rounded-full bg-gradient-to-r from-gold to-lime transition-transform duration-500"
                  style={{ transform: `scaleX(${percent / 100})` }}
                />
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {data.requirements.map((req) => (
                  <RequirementRow key={req.id} req={req} />
                ))}
              </ul>
            </div>
          </>
        )}

        {WalletSection ? (
          <Suspense fallback={<div className="skeleton h-[120px] rounded-[22px]" />}>
            <WalletSection />
          </Suspense>
        ) : (
          <WalletSoon />
        )}

        {extra.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => setOpenId(task.id)}
            className={`press flex items-center gap-3 rounded-[20px] border border-line bg-night-700 p-3 text-left shadow-card ${task.status === 'done' ? 'opacity-70' : ''}`}
            data-testid={`airdrop-task-${task.id}`}
          >
            <TaskIcon icon={task.icon} size={48} />
            <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{task.title[locale]}</span>
            <span className={task.status === 'done' ? 'text-lime' : 'text-white/35'}>
              {task.status === 'done' ? '✓' : '›'}
            </span>
          </button>
        ))}
        <p className="pt-2 text-center text-sm font-bold text-white/40" data-testid="airdrop-soon">
          {t('airdrop.soon')}
        </p>
      </div>
      <TaskSheet task={openTask} onClose={() => setOpenId(null)} />
    </div>
  );
}
