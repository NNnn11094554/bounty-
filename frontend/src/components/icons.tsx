import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Отпечаток кошачьей лапы. */
export function PawIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <ellipse cx="12" cy="15.6" rx="5.2" ry="4.4" />
      <ellipse cx="5.6" cy="10.4" rx="2.1" ry="2.6" transform="rotate(-18 5.6 10.4)" />
      <ellipse cx="9.4" cy="6.4" rx="2.1" ry="2.7" transform="rotate(-6 9.4 6.4)" />
      <ellipse cx="14.6" cy="6.4" rx="2.1" ry="2.7" transform="rotate(6 14.6 6.4)" />
      <ellipse cx="18.4" cy="10.4" rx="2.1" ry="2.6" transform="rotate(18 18.4 10.4)" />
    </svg>
  );
}

/** Золотая монета PAW с отпечатком лапы вместо знака доллара. */
export function CoinIcon({ size = 24, ...props }: IconProps) {
  const id = `coin-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden {...props}>
      <defs>
        <radialGradient id={`${id}-g`} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff3b8" />
          <stop offset="0.45" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#d98f0b" />
        </radialGradient>
        <linearGradient id={`${id}-r`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#b8740a" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${id}-r)`} />
      <circle cx="24" cy="24" r="18.5" fill={`url(#${id}-g)`} />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="#c98510" strokeOpacity="0.45" strokeWidth="1.2" />
      <g fill="#a8650a" fillOpacity="0.85" transform="translate(12 12)">
        <ellipse cx="12" cy="15.6" rx="5.2" ry="4.4" />
        <ellipse cx="5.6" cy="10.4" rx="2.1" ry="2.6" transform="rotate(-18 5.6 10.4)" />
        <ellipse cx="9.4" cy="6.4" rx="2.1" ry="2.7" transform="rotate(-6 9.4 6.4)" />
        <ellipse cx="14.6" cy="6.4" rx="2.1" ry="2.7" transform="rotate(6 14.6 6.4)" />
        <ellipse cx="18.4" cy="10.4" rx="2.1" ry="2.6" transform="rotate(18 18.4 10.4)" />
      </g>
      <ellipse cx="17" cy="14" rx="6" ry="3" fill="#fff" opacity="0.35" transform="rotate(-30 17 14)" />
    </svg>
  );
}

export function BoltIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        d="M13.5 2 4.5 13.4h6.2L9.6 22l9.9-12.3h-6.4L13.5 2Z"
        fill="#ffc93c"
        stroke="#e8a317"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RocketIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M14.5 3.5c3.4-1 6 .1 6 .1s1.1 2.6.1 6c-1 3.4-4.6 6.8-7.6 8.4l-4.9-4.9C9.7 10.1 11.1 4.5 14.5 3.5Z"
        fill="#ff8a3d"
        stroke="#fff"
        strokeOpacity=".7"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="15.8" cy="8.2" r="1.9" fill="#14101f" />
      <path d="M8.1 13.1 4.6 12l2.2-3.2 3.3.2M10.9 15.9l1.1 3.5 3.2-2.2-.2-3.3" fill="#ff5f6d" />
      <path d="M6.2 16.3c-1.5.4-2.4 2.7-2.4 3.9 1.2 0 3.5-.9 3.9-2.4" fill="#ffc93c" />
    </svg>
  );
}
