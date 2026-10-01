import type { AuthResponse, BoostType, StateResponse } from '@meowgul/shared';
import { api } from './client';

export const endpoints = {
  auth: () => api<AuthResponse>('/api/auth', { method: 'POST', retry: true }),
  state: () => api<StateResponse>('/api/state'),
  boost: (type: BoostType) => api<StateResponse>(`/api/boost/${type}`, { method: 'POST' }),
  devInitData: (params: Record<string, string>) =>
    api<{ initData: string }>(`/api/dev/init-data?${new URLSearchParams(params).toString()}`, {
      silent: true,
    }),
};
