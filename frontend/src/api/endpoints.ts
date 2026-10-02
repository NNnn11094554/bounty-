import type {
  AuthResponse,
  BoostType,
  CardUpgradeResponse,
  CardsResponse,
  CipherClaimResponse,
  DailyClaimResponse,
  DailyGamesResponse,
  FriendsResponse,
  LeaderboardResponse,
  StateResponse,
  TaskCheckResponse,
  TaskStartResponse,
  TasksResponse,
  TonProofPayloadResponse,
  WalletConnectRequest,
} from '@meowgul/shared';
import { api } from './client';

export const endpoints = {
  auth: () => api<AuthResponse>('/api/auth', { method: 'POST', retry: true }),
  state: () => api<StateResponse>('/api/state'),
  boost: (type: BoostType) => api<StateResponse>(`/api/boost/${type}`, { method: 'POST' }),
  cards: () => api<CardsResponse>('/api/cards'),
  upgradeCard: (id: string) =>
    api<CardUpgradeResponse>(`/api/cards/${encodeURIComponent(id)}/upgrade`, { method: 'POST' }),
  leagueTop: (level: number) => api<LeaderboardResponse>(`/api/leagues/${level}/top`),
  claimDaily: () => api<DailyClaimResponse>('/api/daily-reward/claim', { method: 'POST' }),
  tasks: () => api<TasksResponse>('/api/tasks'),
  startTask: (id: string) =>
    api<TaskStartResponse>(`/api/tasks/${encodeURIComponent(id)}/start`, { method: 'POST' }),
  checkTask: (id: string) =>
    api<TaskCheckResponse>(`/api/tasks/${encodeURIComponent(id)}/check`, { method: 'POST' }),
  dailyGames: () => api<DailyGamesResponse>('/api/combo'),
  claimCipher: (word: string) =>
    api<CipherClaimResponse>('/api/cipher/claim', { method: 'POST', body: { word } }),
  friends: (after?: number) => api<FriendsResponse>(`/api/friends${after ? `?after=${after}` : ''}`),
  tonProofPayload: () => api<TonProofPayloadResponse>('/api/wallet/proof-payload'),
  connectWallet: (body: WalletConnectRequest) => api<StateResponse>('/api/wallet', { method: 'POST', body }),
  disconnectWallet: () => api<StateResponse>('/api/wallet', { method: 'DELETE' }),
  devInitData: (params: Record<string, string>) =>
    api<{ initData: string }>(`/api/dev/init-data?${new URLSearchParams(params).toString()}`, {
      silent: true,
    }),
};
