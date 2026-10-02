import { formatDuration, formatInt, type TaskView } from '@meowgul/shared';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { CoinIcon } from '../../components/icons';
import { TaskIcon } from '../../components/TaskIcon';
import { checkTask, startTask } from '../../game/earn';
import { centerOf, confetti, flyCoins } from '../../game/effects';
import { tapEngine } from '../../game/tapEngine';
import { useNow } from '../../hooks/useNow';
import { useLocale, useT } from '../../i18n';
import { playSound } from '../../lib/sound';
import { useNav } from '../../store/nav';
import { toast } from '../../store/toasts';
import { haptic } from '../../telegram/webapp';

interface Props {
  task: TaskView | null;
  onClose: () => void;
}

export function TaskSheet({ task, onClose }: Props) {
  return (
    <BottomSheet open={task !== null} onClose={onClose} testId="task-sheet">
      {task && <TaskBody task={task} onClose={onClose} />}
    </BottomSheet>
  );
}

function TaskBody({ task, onClose }: { task: TaskView; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const now = useNow(1000);
  const [busy, setBusy] = useState(false);
  const serverNow = now + (tapEngine.serverNow() - Date.now());
  const done = task.status === 'done';
  const hasLink =
    Boolean(task.url) && (task.type === 'LINK' || task.type === 'VIDEO' || task.type === 'TELEGRAM_CHANNEL');
  const waitMs = task.checkAvailableAt ? task.checkAvailableAt - serverNow : 0;
  const needsVisit = (task.type === 'LINK' || task.type === 'VIDEO') && task.status === 'new';

  const check = async (origin: HTMLElement) => {
    if (busy) return;
    setBusy(true);
    const res = await checkTask(task);
    setBusy(false);
    if (!res) return;
    haptic.notify('success');
    playSound('reward');
    confetti(centerOf(origin));
    flyCoins(centerOf(origin), 14);
    toast.success(t('task.completed', { reward: formatInt(res.reward) }));
    onClose();
  };

  return (
    <div className="flex flex-col items-center gap-3 pt-2 text-center" data-testid={`task-sheet-${task.id}`}>
      <motion.div
        initial={{ scale: 0.6, rotate: -8 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 15 }}
        className="rounded-[28px] shadow-glow"
      >
        <TaskIcon icon={task.icon} size={96} />
      </motion.div>
      <h3 className="text-[22px] font-black leading-tight">{task.title[locale]}</h3>
      {task.description[locale] && (
        <p className="max-w-[320px] text-[15px] font-semibold leading-snug text-white/70">
          {task.description[locale]}
        </p>
      )}
      {task.progress && (
        <p className="text-sm font-extrabold text-teal" data-testid="task-progress">
          {t('task.friends', { current: task.progress.current, required: task.progress.required })}
        </p>
      )}
      <div className="flex items-center gap-2 text-2xl font-black text-gold">
        <CoinIcon size={28} />+{formatInt(task.reward)}
      </div>
      {done ? (
        <Button block disabled className="mt-1 h-14 text-base" data-testid="task-done">
          ✓ {t('task.done')}
        </Button>
      ) : (
        <div className="mt-1 flex w-full flex-col gap-2">
          {hasLink && (
            <Button
              block
              variant={needsVisit ? 'primary' : 'secondary'}
              className="h-14 text-base"
              onClick={() => void startTask(task)}
              data-testid="task-go"
            >
              {t('task.go')}
            </Button>
          )}
          {task.type === 'INVITE_FRIENDS' &&
            (task.progress?.current ?? 0) < (task.progress?.required ?? 0) && (
              <Button
                block
                className="h-14 text-base"
                onClick={() => {
                  onClose();
                  useNav.getState().setTab('friends');
                }}
                data-testid="task-invite"
              >
                {t('task.inviteFriends')}
              </Button>
            )}
          <Button
            block
            variant={needsVisit || task.type === 'INVITE_FRIENDS' ? 'secondary' : 'primary'}
            className="h-14 text-base"
            disabled={needsVisit || waitMs > 0}
            loading={busy}
            onClick={(e) => void check(e.currentTarget)}
            data-testid="task-check"
          >
            {waitMs > 0
              ? t('task.checkIn', { time: formatDuration(waitMs / 1000).slice(3) })
              : t('task.check')}
          </Button>
        </div>
      )}
    </div>
  );
}
