import type {
  AirdropResponse,
  AuthResponse,
  BoostType,
  CardUpgradeResponse,
  CardsResponse,
  CipherClaimResponse,
  DailyClaimResponse,
  DailyGamesResponse,
  FriendsResponse,
  GoldenCoinClaimResponse,
  LeaderboardResponse,
  PlayerSettings,
  ProfileResponse,
  StateResponse,
  TaskCheckResponse,
  TaskStartResponse,
  TasksResponse,
  TonProofPayloadResponse,
  WalletConnectRequest,
  InvoiceResponse,
  CollectionActionResponse,
  CollectionResponse,
  PurchaseStatusResponse,
  ShopProductId,
  ShopResponse,
} from '@meowgul/shared';
import { api } from './client';

export const endpoints = {
  airdrop: () => api<AirdropResponse>('/api/airdrop'),
  collection: () => api<CollectionResponse>('/api/collection'),
  buyCosmetic: (id: string) =>
    api<CollectionActionResponse>(`/api/collection/${encodeURIComponent(id)}/buy`, { method: 'POST' }),
  equipCosmetic: (id: string) =>
    api<CollectionActionResponse>(`/api/collection/${encodeURIComponent(id)}/equip`, { method: 'POST' }),
  shop: () => api<ShopResponse>('/api/shop'),
  createInvoice: (productId: ShopProductId) =>
    api<InvoiceResponse>('/api/shop/invoice', { method: 'POST', body: { productId } }),
  purchaseStatus: (id: number) => api<PurchaseStatusResponse>(`/api/shop/purchases/${id}`, { silent: true }),
  /** только разработка и e2e: имитация оплаты счёта dev-invoice:// */
  devPay: (id: number) => api<{ result: string }>(`/api/dev/shop/pay/${id}`, { method: 'POST' }),
  auth: () => api<AuthResponse>('/api/auth', { method: 'POST', retry: true }),
  state: () => api<StateResponse>('/api/state'),
  boost: (type: BoostType) => api<StateResponse>(`/api/boost/${type}`, { method: 'POST' }),
  cards: () => api<CardsResponse>('/api/cards'),
  upgradeCard: (id: string) =>
    api<CardUpgradeResponse>(`/api/cards/${encodeURIComponent(id)}/upgrade`, { method: 'POST' }),
  /** счёт в Stars за открытие актива */
  assetInvoice: (id: string) =>
    api<InvoiceResponse>(`/api/cards/${encodeURIComponent(id)}/invoice`, { method: 'POST' }),
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
  completeOnboarding: () => api<StateResponse>('/api/onboarding/complete', { method: 'POST' }),
  profile: () => api<ProfileResponse>('/api/profile'),
  achievementsSeen: (ids: string[]) =>
    api<StateResponse>('/api/achievements/seen', { method: 'POST', body: { ids }, silent: true }),
  updateSettings: (patch: Partial<PlayerSettings>) =>
    api<StateResponse>('/api/settings', { method: 'PATCH', body: patch }),
  tutorialSeen: (id: string) =>
    api<StateResponse>(`/api/tutorials/${encodeURIComponent(id)}/seen`, { method: 'POST', silent: true }),
  deleteAccount: () => api<{ ok: true }>('/api/account/delete', { method: 'POST', body: { confirm: true } }),
  claimGoldenCoin: (id: string) =>
    api<GoldenCoinClaimResponse>(`/api/events/${encodeURIComponent(id)}/claim`, { method: 'POST' }),
  devInitData: (params: Record<string, string>) =>
    api<{ initData: string }>(`/api/dev/init-data?${new URLSearchParams(params).toString()}`, {
      silent: true,
    }),
};
