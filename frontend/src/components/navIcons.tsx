import type { ReactNode } from 'react';

/** Иконки нижнего меню: 2px линия, у активной вкладки — заливка акцентом. */
interface NavIconProps {
  active: boolean;
  size?: number;
}

const stroke = (active: boolean) => (active ? '#fff' : 'rgba(255,255,255,0.55)');

function Svg({ size = 26, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      {children}
    </svg>
  );
}

/** Офис: здание с лапкой на фронтоне. */
export function OfficeNavIcon({ active, size }: NavIconProps) {
  const s = stroke(active);
  return (
    <Svg size={size}>
      <path
        d="M4 12.5 14 4l10 8.5V23a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 4 23z"
        fill={active ? '#ff8a3d' : 'none'}
        stroke={s}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M11 24.5v-6.5h6v6.5" stroke={s} strokeWidth="2" strokeLinejoin="round" />
      <g fill={active ? '#fff' : s}>
        <ellipse cx="14" cy="13" rx="2" ry="1.7" />
        <circle cx="11.7" cy="10.6" r="0.9" />
        <circle cx="13.2" cy="9.4" r="0.9" />
        <circle cx="14.8" cy="9.4" r="0.9" />
        <circle cx="16.3" cy="10.6" r="0.9" />
      </g>
    </Svg>
  );
}

/** Mine: кирка. */
export function MineNavIcon({ active, size }: NavIconProps) {
  const s = stroke(active);
  return (
    <Svg size={size}>
      <path d="M8.5 24.5 18 15" stroke={s} strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M4.5 9.5C9 4.5 16.5 3 23 6.2c.6.3.6 1.1 0 1.4L21 8.6l1 1c3.2 6.5 1.7 14-3.3 18.5-.5-1.6-1.1-5.8-3.3-9.5L13 16l-2.6-2.4C6.8 11.5 3 10.9 4.5 9.5z"
        fill={active ? '#ffc93c' : 'none'}
        stroke={s}
        strokeWidth="2"
        strokeLinejoin="round"
        transform="translate(0 -2) scale(.95)"
      />
    </Svg>
  );
}

/** Earn: мешок монет. */
export function EarnNavIcon({ active, size }: NavIconProps) {
  const s = stroke(active);
  return (
    <Svg size={size}>
      <path d="M10.5 7.5 9 4h10l-1.5 3.5" stroke={s} strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M10.5 8h7c4 2.5 6.5 7 6.5 10.5 0 4-3 6-10 6s-10-2-10-6C4 15 6.5 10.5 10.5 8z"
        fill={active ? '#ffc93c' : 'none'}
        stroke={s}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <g fill={active ? '#14101f' : s}>
        <ellipse cx="14" cy="18.6" rx="2.4" ry="2" />
        <circle cx="11" cy="16" r="1" />
        <circle cx="12.9" cy="14.4" r="1" />
        <circle cx="15.1" cy="14.4" r="1" />
        <circle cx="17" cy="16" r="1" />
      </g>
    </Svg>
  );
}

/** Friends: две кошачьи лапы. */
export function FriendsNavIcon({ active, size }: NavIconProps) {
  const s = stroke(active);
  const paw = (x: number, y: number, fill: string) => (
    <g transform={`translate(${x} ${y})`} fill={fill} stroke={s} strokeWidth="1.4">
      <ellipse cx="6" cy="8" rx="3.4" ry="2.9" />
      <circle cx="2" cy="4.4" r="1.4" />
      <circle cx="4.6" cy="2.2" r="1.4" />
      <circle cx="7.4" cy="2.2" r="1.4" />
      <circle cx="10" cy="4.4" r="1.4" />
    </g>
  );
  return (
    <Svg size={size}>
      {paw(2, 11, active ? '#2ed3c6' : 'none')}
      {paw(14, 4, active ? '#a66bff' : 'none')}
    </Svg>
  );
}
