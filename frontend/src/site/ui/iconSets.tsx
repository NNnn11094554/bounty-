import type { ReactNode } from 'react';
import { Icon } from './icons';

/** Шаги «как играть». */
export const STEP_ICONS: Record<string, ReactNode> = {
  Tap: (
    <Icon>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M12 9.5a1.5 1.5 0 0 1 3 0v1a1.5 1.5 0 0 1 3 0V15c0 3.3-2.2 5.5-5.5 5.5-2.4 0-3.7-1-5-3l-2-3.3a1.4 1.4 0 0 1 2.3-1.6L9 14" />
      <path d="M5 6.5a5 5 0 0 1 8.4-3.3" opacity=".5" />
    </Icon>
  ),
  Upgrade: (
    <Icon>
      <path d="M12 20V8M7 12.5 12 7.5l5 5" />
      <path d="M5 4h14" />
    </Icon>
  ),
  Collect: (
    <Icon>
      <rect x="3.5" y="6" width="11" height="14" rx="2" />
      <path d="M8 3.5h10.5a2 2 0 0 1 2 2V17" />
    </Icon>
  ),
  Compete: (
    <Icon>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v3.5M8.5 20h7M10 16.5h4" />
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
  Progression: (
    <Icon>
      <path d="M4 18h4v-4h4v-4h4V6h4" />
    </Icon>
  ),
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
