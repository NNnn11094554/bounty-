import type { DailyClaimResponse, PlayerState, TaskCheckResponse, TaskView } from '@meowgul/shared';
import { endpoints } from '../api/endpoints';
import type { MessageKey } from '../i18n';
import { useGame } from '../store/game';
import { useTasks } from '../store/tasks';
import { openLink } from '../telegram/webapp';
import { runAction } from './actions';

/** Забрать ежедневную награду: баланс и плитка дня обновляются сразу. */
export function claimDaily(): Promise<DailyClaimResponse | null> {
  const rewards = useGame.getState().config?.dailyRewards ?? [];
  return runAction({
    request: () => endpoints.claimDaily(),
    predict: (s: PlayerState) => {
      const reward = rewards[s.daily.day - 1] ?? 0;
      return {
        ...s,
        balance: s.balance + reward,
        totalEarned: s.totalEarned + reward,
        daily: { ...s.daily, claimedToday: true, streakBroken: false, streak: s.daily.streak + 1 },
      };
    },
  });
}

/** Перейти по ссылке задания и запомнить время перехода (для проверки через 30 секунд). */
export async function startTask(task: TaskView): Promise<void> {
  if (task.url) openLink(task.url);
  if (task.status !== 'new' || task.type === 'INVITE_FRIENDS') return;
  try {
    const res = await endpoints.startTask(task.id);
    useTasks.getState().upsert(res.task);
  } catch {
    // переход уже открыт; отметку можно поставить повторным нажатием
  }
}

function checkError(task: TaskView, code: string): MessageKey | undefined {
  if (code === 'NOT_COMPLETED') {
    return task.type === 'TELEGRAM_CHANNEL' ? 'task.error.notSubscribed' : 'task.error.notCompleted';
  }
  if (code === 'UNAVAILABLE') return 'task.error.unavailable';
  if (code === 'COOLDOWN') return 'task.error.early';
  return undefined;
}

/** Проверить задание и получить награду. */
export async function checkTask(task: TaskView): Promise<TaskCheckResponse | null> {
  const res = await runAction({
    request: () => endpoints.checkTask(task.id),
    errorKey: (err) => checkError(task, err.code),
  });
  if (res) useTasks.getState().upsert(res.task);
  return res;
}
