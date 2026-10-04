import type { ReactNode } from 'react';

/** Линейные иконки сайта: 24×24, обводка currentColor — одна толщина и один стиль везде. */
export function Icon({ size = 22, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const TelegramIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M21 4.5 3.6 11.2c-.8.3-.8 1.4 0 1.7l4.3 1.5 1.7 5.1c.2.6 1 .8 1.5.3l2.4-2.3 4.4 3.2c.6.4 1.4.1 1.6-.6L22.2 5.6c.2-.8-.5-1.4-1.2-1.1Z" />
    <path d="m8 14.3 9.6-6.6-6.9 7.8" />
  </Icon>
);

export const XIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <path d="M4.5 4h4.2l10.8 16h-4.2z" />
    <path d="M19.2 4 13.4 10.6M10.6 13.4 4.8 20" />
  </Icon>
);

export const CommunityIcon = ({ size }: { size?: number }) => (
  <Icon size={size}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 6M17.5 14.8c1.6.6 2.7 2.2 3 4.7" />
  </Icon>
);

export const ArrowIcon = ({ size = 18, dir = 1 }: { size?: number; dir?: 1 | -1 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 18 18"
    aria-hidden
    style={{ transform: dir < 0 ? 'scaleX(-1)' : undefined }}
  >
    <path
      d="M3 9h11M10 4.5 14.5 9 10 13.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
    <path
      d="M2.5 6.2 5 8.6l4.6-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);
