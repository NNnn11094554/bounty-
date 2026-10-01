import type { AuthResponse, StateResponse } from '@meowgul/shared';
import { api } from './client';

export const endpoints = {
  auth: () => api<AuthResponse>('/api/auth', { method: 'POST', retry: true }),
  state: () => api<StateResponse>('/api/state'),
  devInitData: (params: Record<string, string>) =>
    api<{ initData: string }>(`/api/dev/init-data?${new URLSearchParams(params).toString()}`, {
      silent: true,
    }),
};
