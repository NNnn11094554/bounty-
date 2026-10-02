/** Airdrop: очки, место среди игроков и прогресс по требованиям. Кошелёк пока не нужен. */
export const AIRDROP_REQUIREMENTS = ['league', 'level', 'friends', 'streak', 'cards', 'tasks'] as const;
export type AirdropRequirementId = (typeof AIRDROP_REQUIREMENTS)[number];

export interface AirdropRequirement {
  id: AirdropRequirementId;
  current: number;
  target: number;
  done: boolean;
}

export interface AirdropResponse {
  /** очки Airdrop = монеты, заработанные за всё время */
  points: number;
  /** место по очкам среди всех игроков (1 — первый) */
  rank: number;
  players: number;
  requirements: AirdropRequirement[];
  /** доля выполненных требований, 0…1 */
  progress: number;
  /** можно ли подключать кошелёк (TON_WALLET_ENABLED) */
  walletEnabled: boolean;
}
