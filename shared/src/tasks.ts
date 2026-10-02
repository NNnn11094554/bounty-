/** Задания Earn: типы, состояния и ответы API. */
import type { PlayerState } from './api.js';
import type { Localized } from './cards.js';

export const TASK_TYPES = [
  'TELEGRAM_CHANNEL',
  'LINK',
  'VIDEO',
  'INVITE_FRIENDS',
  'CHOOSE_HQ',
  'CONNECT_WALLET',
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_SECTIONS = ['SPECIAL', 'LIST', 'AIRDROP'] as const;
export type TaskSection = (typeof TASK_SECTIONS)[number];

/** Иконки заданий — собственные рисунки клиента, без логотипов реальных сервисов. */
export const TASK_ICONS = [
  'channel',
  'video',
  'link',
  'friends',
  'hq',
  'wallet',
  'star',
  'gift',
  'chat',
  'heart',
] as const;
export type TaskIcon = (typeof TASK_ICONS)[number];

/** new — не начато, started — игрок перешёл по ссылке, done — награда получена */
export type TaskStatus = 'new' | 'started' | 'done';

export interface TaskView {
  id: string;
  type: TaskType;
  section: TaskSection;
  title: Localized;
  description: Localized;
  icon: TaskIcon;
  imageUrl: string | null;
  url: string | null;
  reward: number;
  status: TaskStatus;
  /** с какого момента можно нажать «Проверить» (задания со ссылкой), мс */
  checkAvailableAt: number | null;
  /** прогресс заданий-счётчиков (друзья) */
  progress: { current: number; required: number } | null;
}

export interface TasksResponse {
  tasks: TaskView[];
  serverTime: number;
}

export interface TaskStartResponse {
  task: TaskView;
}

export interface TaskCheckResponse {
  state: PlayerState;
  task: TaskView;
  reward: number;
}

/** Задание целиком — для админки. */
export interface AdminTask {
  id: string;
  type: TaskType;
  section: TaskSection;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  icon: TaskIcon;
  imageUrl: string | null;
  url: string | null;
  channelId: string | null;
  requiredCount: number | null;
  reward: number;
  checkDelaySec: number;
  sortOrder: number;
  isActive: boolean;
  /** сколько игроков выполнили */
  completed: number;
}

export type AdminTaskInput = Omit<AdminTask, 'completed'>;
