import type { ReactNode } from 'react';
import { Icon } from './icons';

/** Игровой цикл: играй → собирай → развивай → открывай → возвращайся. */
export const LOOP_ICONS: Record<string, ReactNode> = {
  Play: (
    <Icon>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M12 9.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0V15c0 3.3-2.2 5.5-5.5 5.5-2.4 0-3.7-1-5-3l-2-3.3a1.4 1.4 0 0 1 2.3-1.6L9 14" />
    </Icon>
  ),
  Collect: (
    <Icon>
      <rect x="3.5" y="6" width="11" height="14" rx="2" />
      <path d="M8 3.5h10.5a2 2 0 0 1 2 2V17" />
    </Icon>
  ),
  Grow: (
    <Icon>
      <path d="M4 18h4v-4h4v-4h4V6h4" />
    </Icon>
  ),
  Discover: (
    <Icon>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </Icon>
  ),
  Return: (
    <Icon>
      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
      <path d="M4 4v4.5h4.5" />
    </Icon>
  ),
};

/** Слагаемые пути в разделе airdrop. */
export const PILLAR_ICONS: Record<string, ReactNode> = {
  Activity: (
    <Icon>
      <path d="M3 12h4l2.5-6 4.5 12 2.5-6H21" />
    </Icon>
  ),
  Progression: LOOP_ICONS.Grow,
  Achievements: (
    <Icon>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.5 13.5-1.5 7 5-2.5 5 2.5-1.5-7" />
    </Icon>
  ),
  Community: (
    <Icon>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
      <path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.8c1.6.6 2.7 2.2 3 4.7" />
    </Icon>
  ),
};

/** Что проект даёт партнёрам. */
export const PARTNER_ICONS: Record<string, ReactNode> = {
  Audience: (
    <Icon>
      <path d="M21 4.5 3.6 11.2c-.8.3-.8 1.4 0 1.7l4.3 1.5 1.7 5.1c.2.6 1 .8 1.5.3l2.4-2.3 4.4 3.2c.6.4 1.4.1 1.6-.6L22.2 5.6c.2-.8-.5-1.4-1.2-1.1Z" />
    </Icon>
  ),
  Ecosystem: (
    <Icon>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="5" cy="6" r="2" />
      <circle cx="19" cy="6" r="2" />
      <circle cx="12" cy="20" r="2" />
      <path d="m6.6 7.3 3.5 3M17.4 7.3l-3.5 3M12 14.5V18" />
    </Icon>
  ),
  Growth: PILLAR_ICONS.Community,
  Events: (
    <Icon>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="m12 12.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" />
    </Icon>
  ),
  Rewards: (
    <Icon>
      <rect x="4" y="9" width="16" height="11" rx="1.5" />
      <path d="M3 9h18M12 9v11M12 9c-1.5-3.5-5-4.5-5-2s3 2 5 2c2 0 5 .5 5-2s-3.5-1.5-5 2" />
    </Icon>
  ),
  Visibility: (
    <Icon>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  ),
};
