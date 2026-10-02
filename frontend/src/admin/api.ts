import type {
  AdminBroadcast,
  AdminBroadcastInput,
  AdminCard,
  AdminCardInput,
  AdminDailyDay,
  AdminPlayerDetails,
  AdminPlayerRow,
  AdminSettings,
  AdminStats,
  AdminTask,
  AdminTaskInput,
  CardPreviewResponse,
} from '@meowgul/shared';
import { api } from '../api/client';

const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body });

/** Запросы админ-панели (сервер проверяет ADMIN_TELEGRAM_IDS на каждом). */
export const adminApi = {
  stats: () => api<AdminStats>('/api/admin/stats'),

  cards: () => api<{ cards: AdminCard[] }>('/api/admin/cards'),
  previewCard: (id: string | undefined, card: AdminCardInput) =>
    post<CardPreviewResponse>('/api/admin/cards/preview', { id, card }),
  createCard: (id: string, card: AdminCardInput) =>
    post<{ card: AdminCard }>('/api/admin/cards', { id, card }),
  updateCard: (id: string, card: AdminCardInput) => put<{ card: AdminCard }>(`/api/admin/cards/${id}`, card),
  deleteCard: (id: string) => api<{ ok: true }>(`/api/admin/cards/${id}`, { method: 'DELETE' }),

  tasks: () => api<{ tasks: AdminTask[] }>('/api/admin/tasks'),
  createTask: (task: AdminTaskInput) => post<{ task: AdminTask }>('/api/admin/tasks', task),
  updateTask: (id: string, task: Omit<AdminTaskInput, 'id'>) =>
    put<{ task: AdminTask }>(`/api/admin/tasks/${id}`, task),
  deleteTask: (id: string) =>
    api<{ result: 'deleted' | 'deactivated' }>(`/api/admin/tasks/${id}`, { method: 'DELETE' }),

  daily: () => api<{ days: AdminDailyDay[] }>('/api/admin/daily'),
  setCombo: (dayKey: string, cardIds: string[]) =>
    put<{ ok: true }>(`/api/admin/combo/${dayKey}`, { cardIds }),
  setCipher: (dayKey: string, body: { word: string; hintRu: string; hintEn: string }) =>
    put<{ ok: true }>(`/api/admin/cipher/${dayKey}`, body),

  players: (q: string) => api<{ players: AdminPlayerRow[] }>(`/api/admin/players?q=${encodeURIComponent(q)}`),
  suspicious: () => api<{ players: AdminPlayerRow[] }>('/api/admin/suspicious'),
  player: (id: number, before?: string) =>
    api<AdminPlayerDetails>(`/api/admin/players/${id}${before ? `?before=${before}` : ''}`),
  credit: (id: number, amount: number, reason: string) =>
    post<AdminPlayerDetails>(`/api/admin/players/${id}/credit`, { amount, reason }),
  ban: (id: number, reason: string) => post<AdminPlayerDetails>(`/api/admin/players/${id}/ban`, { reason }),
  unban: (id: number) => post<AdminPlayerDetails>(`/api/admin/players/${id}/unban`),
  clearSuspicion: (id: number) => post<AdminPlayerDetails>(`/api/admin/players/${id}/clear-suspicion`),

  broadcasts: () => api<{ broadcasts: AdminBroadcast[]; audience: number }>('/api/admin/broadcasts'),
  createBroadcast: (b: AdminBroadcastInput) =>
    post<{ broadcast: AdminBroadcast }>('/api/admin/broadcasts', b),
  broadcastAction: (id: number, action: 'test' | 'start' | 'pause' | 'resume' | 'cancel') =>
    post<{ broadcast?: AdminBroadcast; ok?: true }>(`/api/admin/broadcasts/${id}/${action}`),

  settings: () => api<AdminSettings>('/api/admin/settings'),
  saveSettings: (patch: Partial<Omit<AdminSettings, 'nextHappyHour'>>) =>
    put<AdminSettings>('/api/admin/settings', patch),
};
