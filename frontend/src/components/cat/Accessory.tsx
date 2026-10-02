import { forwardRef, useId, type ReactNode } from 'react';
import { ACCESSORY_LAYOUT, type AccessoryKind } from '../../game/skins';

function gold(id: string) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff1a8" />
      <stop offset="0.5" stopColor="#ffc93c" />
      <stop offset="1" stopColor="#c98510" />
    </linearGradient>
  );
}

function shapes(kind: AccessoryKind, id: string): ReactNode {
  const g = `url(#${id})`;
  switch (kind) {
    case 'crown':
      return (
        <>
          <defs>{gold(id)}</defs>
          <path
            d="M22 58 16 22l24 18 20-28 20 28 24-18-6 36Z"
            fill={g}
            stroke="#8a5a00"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <rect x="20" y="54" width="80" height="12" rx="4" fill={g} stroke="#8a5a00" strokeWidth="2.5" />
          <circle cx="16" cy="20" r="5" fill={g} stroke="#8a5a00" strokeWidth="2" />
          <circle cx="60" cy="10" r="6" fill={g} stroke="#8a5a00" strokeWidth="2" />
          <circle cx="104" cy="20" r="5" fill={g} stroke="#8a5a00" strokeWidth="2" />
          <circle cx="60" cy="60" r="3.6" fill="#ff4fa3" />
          <circle cx="40" cy="60" r="2.6" fill="#38c8ff" />
          <circle cx="80" cy="60" r="2.6" fill="#38c8ff" />
        </>
      );
    case 'halo':
      return (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#ffb3df" />
            </linearGradient>
          </defs>
          <ellipse cx="100" cy="16" rx="34" ry="9" fill="none" stroke="#fff3c4" strokeWidth="6" />
          <ellipse
            cx="100"
            cy="16"
            rx="34"
            ry="9"
            fill="none"
            stroke="#ffd1ec"
            strokeWidth="2"
            opacity="0.8"
          />
          <path
            d="M60 64C42 40 20 36 4 44c12 4 16 10 12 16 12-2 22 2 26 8 4-6 12-6 18-4Z"
            fill={g}
            stroke="#ff8fd0"
            strokeWidth="2"
          />
          <path
            d="M140 64c18-24 40-28 56-20-12 4-16 10-12 16-12-2-22 2-26 8-4-6-12-6-18-4Z"
            fill={g}
            stroke="#ff8fd0"
            strokeWidth="2"
          />
        </>
      );
    case 'antenna':
      return (
        <>
          <path d="M16 70Q60 4 104 70" fill="none" stroke="#0f1c4d" strokeWidth="8" strokeLinecap="round" />
          <path d="M16 70Q60 4 104 70" fill="none" stroke="#38c8ff" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M34 38 24 6M86 38l10-32" stroke="#7fe3ff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="24" cy="6" r="5" fill="#bff3ff" className="acc-led" />
          <circle cx="96" cy="6" r="5" fill="#bff3ff" className="acc-led" />
          <circle cx="45" cy="24" r="2.4" fill="#7fe3ff" />
          <circle cx="60" cy="20" r="2.4" fill="#7fe3ff" />
          <circle cx="75" cy="24" r="2.4" fill="#7fe3ff" />
        </>
      );
    case 'coinCrown':
      return (
        <>
          <defs>{gold(id)}</defs>
          <path
            d="M18 60 12 20l22 18 26-30 26 30 22-18-6 40Z"
            fill={g}
            stroke="#8a5a00"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <rect x="16" y="56" width="88" height="12" rx="4" fill={g} stroke="#8a5a00" strokeWidth="2.5" />
          <circle cx="60" cy="38" r="13" fill="#ffe27a" stroke="#8a5a00" strokeWidth="2.5" />
          <text
            x="60"
            y="44"
            textAnchor="middle"
            fontSize="17"
            fontWeight="900"
            fill="#8a5a00"
            fontFamily="Arial, sans-serif"
          >
            B
          </text>
          <path d="M57 26v4M63 26v4M57 46v4M63 46v4" stroke="#8a5a00" strokeWidth="2" />
        </>
      );
    case 'katana':
      return (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#dfe6f2" />
              <stop offset="1" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          <path d="M34 50 112 6" stroke={g} strokeWidth="6" strokeLinecap="round" />
          <path d="M34 50 112 6" stroke="#9aa6bb" strokeWidth="1.2" />
          <ellipse cx="32" cy="51" rx="8" ry="4" transform="rotate(-30 32 51)" fill="#ffc93c" />
          <path d="M30 52 8 66" stroke="#7a0f1f" strokeWidth="8" strokeLinecap="round" />
          <path d="M26 55l-4 2.4M20 58.6l-4 2.4" stroke="#ff6b6b" strokeWidth="2" />
        </>
      );
    case 'headphones':
      return (
        <>
          <path d="M18 70Q70-8 122 70" fill="none" stroke="#1e1430" strokeWidth="10" strokeLinecap="round" />
          <path d="M18 70Q70-8 122 70" fill="none" stroke="#ff4fd8" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="4" y="56" width="26" height="32" rx="12" fill="#1a1226" stroke="#7a5cff" strokeWidth="3" />
          <rect
            x="110"
            y="56"
            width="26"
            height="32"
            rx="12"
            fill="#1a1226"
            stroke="#7a5cff"
            strokeWidth="3"
          />
          <rect x="10" y="64" width="14" height="16" rx="7" fill="#ff4fd8" className="acc-led" />
          <rect x="116" y="64" width="14" height="16" rx="7" fill="#ff4fd8" className="acc-led" />
        </>
      );
    case 'horns':
      return (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#1a0b2b" />
              <stop offset="1" stopColor="#7a2cff" />
            </linearGradient>
          </defs>
          <path d="M44 66C30 54 18 36 20 6c8 20 22 32 36 40Z" fill={g} stroke="#b07aff" strokeWidth="1.5" />
          <path d="M76 66c14-12 26-30 24-60-8 20-22 32-36 40Z" fill={g} stroke="#b07aff" strokeWidth="1.5" />
          <circle cx="20" cy="8" r="3" fill="#ff2b5e" className="acc-led" />
          <circle cx="100" cy="8" r="3" fill="#ff2b5e" className="acc-led" />
        </>
      );
    case 'planet':
      return (
        <>
          <defs>
            <radialGradient id={id} cx="35%" cy="30%">
              <stop offset="0" stopColor="#e3d8ff" />
              <stop offset="0.5" stopColor="#7a5cff" />
              <stop offset="1" stopColor="#1b2a6b" />
            </radialGradient>
          </defs>
          <circle cx="62" cy="36" r="20" fill={g} />
          <ellipse
            cx="62"
            cy="38"
            rx="36"
            ry="9"
            fill="none"
            stroke="#2ed3c6"
            strokeWidth="3"
            transform="rotate(-18 62 38)"
          />
          <circle cx="18" cy="12" r="2" fill="#fff" />
          <circle cx="106" cy="58" r="1.6" fill="#fff" />
          <circle cx="100" cy="10" r="1.4" fill="#fff" />
        </>
      );
    case 'bigCrown':
      return (
        <>
          <defs>{gold(id)}</defs>
          <path
            d="M18 66 10 18l22 22 16-34 22 30 22-30 16 34 22-22-8 48Z"
            fill={g}
            stroke="#8a5a00"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect x="16" y="62" width="108" height="14" rx="5" fill={g} stroke="#8a5a00" strokeWidth="3" />
          <circle cx="10" cy="16" r="5" fill={g} stroke="#8a5a00" strokeWidth="2" />
          <circle cx="48" cy="5" r="5" fill={g} stroke="#8a5a00" strokeWidth="2" />
          <circle cx="92" cy="5" r="5" fill={g} stroke="#8a5a00" strokeWidth="2" />
          <circle cx="130" cy="16" r="5" fill={g} stroke="#8a5a00" strokeWidth="2" />
          <path d="m70 40 8 10-8 10-8-10Z" fill="#ff4fa3" stroke="#8a0040" strokeWidth="1.5" />
          <circle cx="40" cy="69" r="3.4" fill="#38c8ff" />
          <circle cx="70" cy="69" r="3.8" fill="#39ff88" />
          <circle cx="100" cy="69" r="3.4" fill="#38c8ff" />
        </>
      );
    case 'terminal':
      return (
        <>
          <rect
            x="14"
            y="10"
            width="92"
            height="52"
            rx="10"
            fill="#04140b"
            stroke="#39ff88"
            strokeWidth="3"
          />
          <circle cx="26" cy="20" r="2.4" fill="#ff5f6d" />
          <circle cx="34" cy="20" r="2.4" fill="#ffc93c" />
          <circle cx="42" cy="20" r="2.4" fill="#39ff88" />
          <text x="26" y="50" fontSize="22" fontWeight="900" fill="#39ff88" fontFamily="monospace">
            &gt;_
          </text>
          <rect x="62" y="34" width="12" height="18" fill="#39ff88" className="acc-blink" />
        </>
      );
    case 'gem':
      return (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.5" stopColor="#9fc1ff" />
              <stop offset="1" stopColor="#b48cff" />
            </linearGradient>
          </defs>
          <path
            d="M30 30 46 10h28l16 20-30 56Z"
            fill={g}
            stroke="#ffffff"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path
            d="M30 30h60M46 10l14 76M74 10 60 86M46 10l-2 20M74 10l2 20"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="1.5"
          />
          <path d="m96 8 2.5 6 6 2.5-6 2.5L96 25l-2.5-6-6-2.5 6-2.5Z" fill="#fff" className="acc-led" />
        </>
      );
    case 'tiara':
      return (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd1ec" />
              <stop offset="1" stopColor="#ff3d9a" />
            </linearGradient>
          </defs>
          <path d="M14 62Q60 30 106 62" fill="none" stroke={g} strokeWidth="7" strokeLinecap="round" />
          <path
            d="m26 52-4-18 14 12M94 52l4-18-14 12M42 44l2-20 10 16M78 44l-2-20-10 16"
            fill={g}
            stroke="#ff3d9a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M60 50c-1.5-6-12-8-12-16 0-4 3-7 6.5-7 2.5 0 4.5 1.5 5.5 3.5 1-2 3-3.5 5.5-3.5 3.5 0 6.5 3 6.5 7 0 8-10.5 10-12 16Z"
            fill="#ff1f7a"
            stroke="#ffd1ec"
            strokeWidth="2"
          />
        </>
      );
    case 'neonCrown':
      return (
        <>
          <path
            d="M20 60 14 20l24 18 22-28 22 28 24-18-6 40Z"
            fill="#0b0f22"
            fillOpacity="0.7"
            stroke="#38c8ff"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect x="18" y="56" width="84" height="10" rx="4" fill="#0b0f22" stroke="#ff4fd8" strokeWidth="3" />
          <circle cx="14" cy="18" r="4" fill="#ff4fd8" className="acc-led" />
          <circle cx="60" cy="8" r="5" fill="#38c8ff" className="acc-led" />
          <circle cx="106" cy="18" r="4" fill="#ff4fd8" className="acc-led" />
          <path d="m60 34 7 9-7 9-7-9Z" fill="#ff4fd8" />
        </>
      );
  }
}

/** Аксессуар скина над головой кота (SVG; без картинок). */
export const Accessory = forwardRef<SVGSVGElement, { kind: AccessoryKind; size: number }>(function Accessory(
  { kind, size },
  ref,
) {
  const id = useId().replace(/:/g, '');
  const l = ACCESSORY_LAYOUT[kind];
  const w = size * l.w;
  return (
    <svg
      ref={ref}
      viewBox={l.vb}
      width={w}
      className={`cat-acc acc-${kind} pointer-events-none absolute`}
      style={{ left: size / 2 - w / 2 + size * l.x, top: size * l.top }}
      aria-hidden
    >
      {shapes(kind, `acc${id}`)}
    </svg>
  );
});
