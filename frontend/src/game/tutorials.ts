import type { TutorialId } from '@meowgul/shared';
import type { MessageKey } from '../i18n';

export interface TutorialStep {
  /** элемент с data-tour="…" */
  target: string;
  text: MessageKey;
}

/** Подсказки при первом открытии вкладок: подсветка элемента, стрелка и текст. */
export const TUTORIAL_STEPS: Record<TutorialId, TutorialStep[]> = {
  office: [
    { target: 'cat', text: 'tour.office.cat' },
    { target: 'energy', text: 'tour.office.energy' },
    { target: 'boosts', text: 'tour.office.boosts' },
    { target: 'league', text: 'tour.office.league' },
    { target: 'profile', text: 'tour.office.profile' },
  ],
  mine: [
    { target: 'cards', text: 'tour.mine.cards' },
    { target: 'income', text: 'tour.mine.income' },
    { target: 'combo', text: 'tour.mine.combo' },
  ],
  friends: [
    { target: 'bonuses', text: 'tour.friends.bonuses' },
    { target: 'invite', text: 'tour.friends.invite' },
  ],
  earn: [
    { target: 'daily', text: 'tour.earn.daily' },
    { target: 'tasks', text: 'tour.earn.tasks' },
  ],
  airdrop: [{ target: 'wallet', text: 'tour.airdrop.wallet' }],
  boosts: [
    { target: 'free-boosts', text: 'tour.boosts.free' },
    { target: 'paid-boosts', text: 'tour.boosts.paid' },
  ],
};
