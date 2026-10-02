/** Подсказки при первом открытии вкладок и экранов; просмотренные хранятся у игрока на сервере. */
export const TUTORIALS = ['office', 'mine', 'friends', 'earn', 'airdrop', 'boosts'] as const;
export type TutorialId = (typeof TUTORIALS)[number];

export function isTutorialId(id: string): id is TutorialId {
  return (TUTORIALS as readonly string[]).includes(id);
}
