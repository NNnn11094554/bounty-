import type { CardGlyph, CardIconBadge } from '@meowgul/shared';
import type { ReactNode } from 'react';
import { Paw, Sparkle, Star } from './glyphParts';

/**
 * Рисунки карточек: единый стиль — белые формы с деталями цвета фона карточки,
 * сетка 48×48. W — основная заливка, D — детали (тёмный цвет палитры), A — полупрозрачный белый.
 */
const W = '#fff';
const D = 'currentColor';
const A = 'rgba(255,255,255,0.55)';
const GOLD = '#ffd75e';
const RED = '#ff5f6d';

const line = (width: number, color = W) =>
  ({
    stroke: color,
    strokeWidth: width,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
  }) as const;

function rays(cx: number, cy: number, r1: number, r2: number, count: number, offset = 0): string {
  return Array.from({ length: count }, (_, i) => {
    const a = ((Math.PI * 2) / count) * i + offset;
    const p = (r: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    return `M${p(r1)}L${p(r2)}`;
  }).join('');
}

function gearPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    for (const [da, r] of [
      [-0.3, inner],
      [-0.17, outer],
      [0.17, outer],
      [0.3, inner],
    ] as const) {
      const ang = a + da * step * 1.6;
      pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)} ${(cy + r * Math.sin(ang)).toFixed(2)}`);
    }
  }
  return `M${pts.join('L')}Z`;
}

export const GLYPHS: Record<Exclude<CardGlyph, 'character'>, ReactNode> = {
  candles: (
    <>
      <path d="M16 6v36M32 4v34" {...line(3)} />
      <rect x="10" y="13" width="12" height="18" rx="3" fill={W} />
      <rect x="26" y="10" width="12" height="20" rx="3" fill={D} stroke={W} strokeWidth="3" />
    </>
  ),
  chart_line: (
    <>
      <path d="M7 7v33h34" {...line(3.5)} />
      <path d="M12 32l9-10 7 6 12-14" {...line(4.5)} />
      <path d="M32 13h8v8" {...line(4.5)} />
    </>
  ),
  coins: (
    <>
      {[34, 26, 18].map((y) => (
        <g key={y}>
          <path d={`M7 ${y}v4c0 3 5.8 5 13 5s13-2 13-5v-4`} fill={D} stroke={W} strokeWidth="2.4" />
          <ellipse cx="20" cy={y} rx="13" ry="5" fill={W} />
        </g>
      ))}
      <circle cx="36" cy="13" r="8" fill={GOLD} stroke={W} strokeWidth="2.6" />
      <path d="M36 9v8" {...line(2.4, D)} />
    </>
  ),
  handshake: (
    <>
      <path d="M3 19l9-6 9 3 6-2 6 1 12 7v9l-6 2-10 9c-1.5 1.3-3.6 1.2-4.9-.2L9 29l-6-1z" fill={W} />
      <path d="M22 16l-8 7c-1.3 1.2-.7 3.3 1 3.7 1 .2 2-.1 2.7-.8l6.3-5 9.5 8.5" {...line(2.6, D)} />
      <path d="M17 33l3 3M21 30l3 3M25 27l3 3" {...line(2.2, D)} />
    </>
  ),
  bars: (
    <>
      <rect x="8" y="26" width="8" height="14" rx="2" fill={W} />
      <rect x="20" y="18" width="8" height="22" rx="2" fill={W} />
      <rect x="32" y="8" width="8" height="32" rx="2" fill={D} stroke={W} strokeWidth="2.6" />
      <path d="M5 43h38" {...line(3)} />
    </>
  ),
  rocket: (
    <>
      <path d="M15 22l-7 9v6l8-4zM33 22l7 9v6l-8-4z" fill={A} />
      <path d="M24 3c7.5 5 10.5 13.5 9 25H15C13.5 16.5 16.5 8 24 3z" fill={W} />
      <circle cx="24" cy="16" r="4.6" fill={D} />
      <path d="M19 31h10l-2 5h-6z" fill={D} />
      <path d="M21 37.5c0 4 3 7.5 3 7.5s3-3.5 3-7.5z" fill={GOLD} />
    </>
  ),
  chip: (
    <>
      <path
        d="M18 5v7M24 5v7M30 5v7M18 36v7M24 36v7M30 36v7M5 18h7M5 24h7M5 30h7M36 18h7M36 24h7M36 30h7"
        {...line(2.8)}
      />
      <rect x="11" y="11" width="26" height="26" rx="5" fill={W} />
      <rect x="18" y="18" width="12" height="12" rx="2.5" fill={D} />
    </>
  ),
  gamepad: (
    <>
      <path
        d="M14 13h20c6.5 0 9.5 5.5 10.5 12.5S43 38 39 38c-3 0-5-3-7-6H16c-2 3-4 6-7 6-4 0-6.5-5.5-5.5-12.5S7.5 13 14 13z"
        fill={W}
      />
      <path d="M14 20v9M9.5 24.5h9" {...line(3.2, D)} />
      <circle cx="32" cy="21" r="2.6" fill={D} />
      <circle cx="37" cy="26" r="2.6" fill={D} />
    </>
  ),
  scales: (
    <>
      <path d="M24 7v32M14 42h20M8 12h32" {...line(3.2)} />
      <path d="M8 12l-5 13M8 12l5 13M40 12l-5 13M40 12l5 13" {...line(1.8)} />
      <path d="M2 25a6 4 0 0 0 12 0zM34 25a6 4 0 0 0 12 0z" fill={W} />
      <circle cx="24" cy="7" r="3.4" fill={W} />
      <circle cx="24" cy="7" r="1.4" fill={D} />
    </>
  ),
  people: (
    <>
      <circle cx="33" cy="16" r="6" fill={A} />
      <path d="M27 29c2-1.3 4-2 6-2 6 0 11 4.5 11 12H31z" fill={A} />
      <circle cx="17" cy="15" r="7.5" fill={W} />
      <path d="M3 41c0-8.5 6-14 14-14s14 5.5 14 14z" fill={W} />
      <path d="M14 15h.01M20 15h.01" {...line(3, D)} />
    </>
  ),
  robot: (
    <>
      <path d="M24 5v6M4 18v8M44 18v8" {...line(3.4)} />
      <circle cx="24" cy="5" r="3" fill={GOLD} />
      <rect x="9" y="10" width="30" height="24" rx="7" fill={W} />
      <rect x="14" y="16" width="20" height="10" rx="5" fill={D} />
      <circle cx="19.5" cy="21" r="2.4" fill="#7ce9df" />
      <circle cx="28.5" cy="21" r="2.4" fill="#7ce9df" />
      <rect x="15" y="36" width="18" height="7" rx="3" fill={A} />
      <path d="M20 30h8" {...line(2.4, D)} />
    </>
  ),
  palette: (
    <>
      <path
        d="M24 5C13 5 5 13 5 23c0 9 7 16 15 16 3 0 4.2-2 3-4-1.5-2.5.5-5 3-5h5c6 0 12-4 12-11C43 12 34 5 24 5z"
        fill={W}
      />
      <circle cx="14.5" cy="21" r="3.4" fill={RED} />
      <circle cx="21" cy="13" r="3.4" fill={GOLD} />
      <circle cx="30.5" cy="13.5" r="3.4" fill="#4ade80" />
      <circle cx="35.5" cy="21.5" r="3.4" fill="#4f9dff" />
    </>
  ),
  bank: (
    <>
      <path d="M24 3L4 13v4h40v-4z" fill={W} />
      <path d="M10 21v13M18 21v13M30 21v13M38 21v13" {...line(4.2)} />
      <rect x="4" y="37" width="40" height="6" rx="2" fill={W} />
      <circle cx="24" cy="11.5" r="2.6" fill={D} />
      <path d="M24 21v13" {...line(4.2, A)} />
    </>
  ),
  pie: (
    <>
      <path d="M22 26V10A16 16 0 1 0 38 26z" fill={W} />
      <path d="M26 22V6a16 16 0 0 1 16 16z" fill={D} stroke={W} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M22 26l-11 11" {...line(2.4, D)} />
    </>
  ),
  briefcase: (
    <>
      <path d="M17 12V9a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" {...line(3.2)} />
      <rect x="5" y="12" width="38" height="28" rx="5" fill={W} />
      <path d="M5 23h38" stroke={D} strokeWidth="3" />
      <rect x="20" y="20" width="8" height="7" rx="2" fill={D} />
    </>
  ),
  bolt: <path d="M28 3L9 27h12l-3 18 21-26H27z" fill={W} stroke={D} strokeWidth="2" strokeLinejoin="round" />,
  drop: (
    <>
      <path d="M24 4c8 11 14 18 14 26a14 14 0 0 1-28 0c0-8 6-15 14-26z" fill={W} />
      <path d="M17 30a7 7 0 0 0 7 7" {...line(3, D)} />
    </>
  ),
  crystal_ball: (
    <>
      <path d="M12 37h24l3 6H9z" fill={A} />
      <circle cx="24" cy="21" r="15" fill={W} />
      <path d="M14 18a10 10 0 0 1 8-8" {...line(3, D)} />
      <Sparkle cx={28} cy={26} r={6} fill={D} />
    </>
  ),
  server: (
    <>
      {[6, 19, 32].map((y) => (
        <g key={y}>
          <rect x="8" y={y} width="32" height="10" rx="3" fill={W} />
          <circle cx="14" cy={y + 5} r="2" fill={D} />
          <path d={`M22 ${y + 5}h12`} {...line(2.4, D)} />
        </g>
      ))}
    </>
  ),
  shield: (
    <>
      <path d="M24 4l16 6v12c0 10-7 18-16 22C15 40 8 32 8 22V10z" fill={W} />
      <path d="M24 9v30c6-3.5 11-9 11-17v-8.5z" fill={D} />
    </>
  ),
  globe: (
    <>
      <circle cx="24" cy="24" r="18" fill={W} />
      <path
        d="M6 24h36M24 6c-6 5-8.5 11-8.5 18s2.5 13 8.5 18M24 6c6 5 8.5 11 8.5 18S30 37 24 42M9.5 14.5h29M9.5 33.5h29"
        {...line(2.4, D)}
      />
    </>
  ),
  bridge: (
    <>
      <path d="M6 30c6-15 30-15 36 0" {...line(3.4)} />
      <path d="M12 22.5v7.5M18 19v11M24 18v12M30 19v11M36 22.5v7.5" {...line(2.4)} />
      <path d="M3 30h42M8 30v10M40 30v10" {...line(4)} />
      <path d="M3 44c4-2 8 2 12 0s8 2 12 0 8 2 12 0 6 1 6 1" {...line(2.4, A)} />
    </>
  ),
  cat_head: (
    <>
      <path d="M8 6l9 9h14l9-9v20c0 9.5-7 16-16 16S8 35.5 8 26z" fill={W} />
      <ellipse cx="18" cy="25" rx="2.6" ry="3.6" fill={D} />
      <ellipse cx="30" cy="25" rx="2.6" ry="3.6" fill={D} />
      <path d="M21.5 31h5L24 34z" fill={D} />
      <path d="M8 31l-5 1M8 34l-5 3M40 31l5 1M40 34l5 3" {...line(2, A)} />
    </>
  ),
  building: (
    <>
      <rect x="9" y="6" width="30" height="37" rx="3" fill={W} />
      {[11, 18, 25].map((y) =>
        [14, 21.5, 29].map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="5" height="4" rx="1" fill={D} />
        )),
      )}
      <rect x="20" y="33" width="8" height="10" rx="1.5" fill={D} />
      <path d="M4 43h40" {...line(3)} />
    </>
  ),
  chain: (
    <>
      <rect x="3" y="17" width="24" height="14" rx="7" transform="rotate(-35 15 24)" {...line(4.4)} />
      <rect x="21" y="17" width="24" height="14" rx="7" transform="rotate(-35 33 24)" {...line(4.4, A)} />
    </>
  ),
  skyscraper: (
    <>
      <path d="M7 44V24h10v20M31 44V20h10v24" fill={A} />
      <path d="M16 44V13l8-9 8 9v31z" fill={W} />
      <path d="M21 17h6M21 23h6M21 29h6M21 35h6" {...line(2.4, D)} />
      <path d="M3 44h42" {...line(3)} />
    </>
  ),
  headset: (
    <>
      <path d="M8 27v-3a16 16 0 0 1 32 0v3" {...line(4)} />
      <path d="M38 37c0 4-4 6.5-10 6.5" {...line(3)} />
      <rect x="5" y="23" width="9" height="15" rx="4" fill={W} />
      <rect x="34" y="23" width="9" height="15" rx="4" fill={W} />
      <rect x="21" y="40.5" width="8" height="6" rx="3" fill={W} />
      <path d="M9.5 27v7M38.5 27v7" {...line(2.4, D)} />
    </>
  ),
  book: (
    <>
      <path d="M24 12C19 8 12 7 5 8v29c7-1 14 0 19 4 5-4 12-5 19-4V8c-7-1-14 0-19 4z" fill={W} />
      <path d="M24 12v29" stroke={D} strokeWidth="2.6" />
      <path
        d="M10 16c3 0 6 .5 9 2M10 22c3 0 6 .5 9 2M10 28c3 0 6 .5 9 2M29 18c3-1.5 6-2 9-2M29 24c3-1.5 6-2 9-2"
        {...line(2.2, D)}
      />
    </>
  ),
  smiley: (
    <>
      <circle cx="24" cy="24" r="19" fill={W} />
      <ellipse cx="17" cy="19" rx="2.6" ry="3.6" fill={D} />
      <ellipse cx="31" cy="19" rx="2.6" ry="3.6" fill={D} />
      <path d="M13.5 26.5c2 6.5 6 9.5 10.5 9.5s8.5-3 10.5-9.5z" fill={D} />
    </>
  ),
  mascot: (
    <>
      <path d="M12 33l-7-7M36 33l7-7" {...line(4.4)} />
      <path d="M11 45c0-9.5 5.5-16 13-16s13 6.5 13 16z" fill={W} />
      <path d="M14 4l6 6h8l6-6v13a10 10 0 0 1-20 0z" fill={W} />
      <circle cx="20" cy="16" r="2" fill={D} />
      <circle cx="28" cy="16" r="2" fill={D} />
      <path d="M22 21.5h4" {...line(2.2, D)} />
      <path d="M24 33v12" stroke={D} strokeWidth="2" strokeDasharray="2 2.4" />
    </>
  ),
  newspaper: (
    <>
      <path d="M38 15h5v21a5 5 0 0 1-5 5" fill={A} />
      <rect x="5" y="7" width="33" height="34" rx="3" fill={W} />
      <rect x="9" y="12" width="25" height="6" rx="1.5" fill={D} />
      <path d="M9 24h9M9 29h9M9 34h9" {...line(2.2, D)} />
      <rect x="22" y="22" width="12" height="14" rx="1.5" fill={D} />
    </>
  ),
  video: (
    <>
      <rect x="4" y="13" width="29" height="22" rx="5" fill={W} />
      <path d="M33 21l11-7v20l-11-7z" fill={W} />
      <circle cx="11" cy="20" r="3" fill={RED} />
      <path d="M11 28h15" {...line(2.6, D)} />
    </>
  ),
  chat: (
    <>
      <path
        d="M8 7h32a4 4 0 0 1 4 4v19a4 4 0 0 1-4 4H22l-9 8v-8H8a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4z"
        fill={W}
      />
      <circle cx="15" cy="20.5" r="2.8" fill={D} />
      <circle cx="24" cy="20.5" r="2.8" fill={D} />
      <circle cx="33" cy="20.5" r="2.8" fill={D} />
    </>
  ),
  mic: (
    <>
      <path d="M10 22a14 14 0 0 0 28 0M24 36v6M16 43h16" {...line(3.4)} />
      <rect x="16" y="4" width="16" height="25" rx="8" fill={W} />
      <path d="M16 13h6M16 19h6" {...line(2.4, D)} />
    </>
  ),
  magnifier: (
    <>
      <path d="M30 30l11 11" {...line(6.5)} />
      <circle cx="20" cy="20" r="13" fill={A} stroke={W} strokeWidth="4.2" />
      <path d="M13 18a7 7 0 0 1 6-6" {...line(3)} />
    </>
  ),
  ticket: (
    <g transform="rotate(-12 24 24)">
      <path d="M5 14h38v7a3 3 0 0 0 0 6v7H5v-7a3 3 0 0 0 0-6z" fill={W} />
      <path d="M31 15v18" stroke={D} strokeWidth="2.4" strokeDasharray="3 3" />
      <Star cx={18} cy={24} r={6.5} fill={D} />
    </g>
  ),
  camera: (
    <>
      <path
        d="M8 14h7l3-5h12l3 5h7a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z"
        fill={W}
      />
      <circle cx="24" cy="26" r="9" fill={D} />
      <circle cx="24" cy="26" r="4.5" fill={A} />
      <circle cx="37" cy="19" r="2" fill={D} />
    </>
  ),
  tv: (
    <>
      <path d="M17 4l7 8 7-8M14 43h20" {...line(3.2)} />
      <rect x="4" y="12" width="40" height="28" rx="5" fill={W} />
      <rect x="9" y="17" width="10" height="18" fill={GOLD} />
      <rect x="19" y="17" width="10" height="18" fill="#4ade80" />
      <rect x="29" y="17" width="10" height="18" fill="#4f9dff" />
    </>
  ),
  billboard: (
    <>
      <path d="M14 29v15M34 29v15" {...line(4)} />
      <rect x="4" y="6" width="40" height="24" rx="3" fill={W} />
      <path d="M9 13h18M9 20h12" {...line(3, D)} />
      <circle cx="35" cy="18" r="5.5" fill={D} />
    </>
  ),
  laptop: (
    <>
      <rect x="9" y="8" width="30" height="22" rx="3" fill={W} />
      <rect x="13" y="12" width="22" height="14" rx="1.5" fill={D} />
      <path d="M3 33h42l-3 6H6z" fill={W} />
      <path d="M20 36h8" {...line(2.2, D)} />
    </>
  ),
  calculator: (
    <>
      <rect x="10" y="4" width="28" height="40" rx="5" fill={W} />
      <rect x="14" y="8" width="20" height="9" rx="2" fill={D} />
      {[23, 30, 37].map((y) =>
        [17, 24, 31].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill={D} />),
      )}
    </>
  ),
  medal: (
    <>
      <path d="M13 3h8l5 13h-8zM35 3h-8l-5 13h8z" fill={A} />
      <circle cx="24" cy="30" r="14" fill={W} />
      <Star cx={24} cy={30} r={8} fill={D} />
    </>
  ),
  stage: (
    <>
      <path d="M24 14l-9 25h18z" fill={A} />
      <rect x="3" y="4" width="42" height="5" rx="1.5" fill={W} />
      <path d="M3 9c5 10 9 20 9 31H3zM45 9c-5 10-9 20-9 31h9z" fill={W} />
      <rect x="3" y="39" width="42" height="5" rx="1.5" fill={W} />
      <circle cx="24" cy="14" r="3" fill={W} />
      <path d="M7 14v20M41 14v20" {...line(1.6, D)} />
    </>
  ),
  heart: (
    <>
      <path d="M24 42S6 31 6 18a9 9 0 0 1 18-3 9 9 0 0 1 18 3c0 13-18 24-18 24z" fill={W} />
      <path d="M12 18a5 5 0 0 1 5-5" {...line(2.8, D)} />
    </>
  ),
  clapper: (
    <>
      <rect x="6" y="18" width="36" height="25" rx="3" fill={W} />
      <path d="M5 11l35-8 2 8-35 8z" fill={W} />
      <path d="M12 9.5l5 7M21 7.5l5 7M30 5.5l5 7" {...line(3, D)} />
      <path d="M12 27h24M12 34h14" {...line(2.6, D)} />
    </>
  ),
  plane: (
    <>
      <path d="M44 6L4 21l13 5 3 15 6-9 11 7z" fill={W} />
      <path d="M17 26L44 6 26 32" {...line(2.4, D)} />
    </>
  ),
  stadium: (
    <>
      <path d="M4 26v7c0 6 9 11 20 11s20-5 20-11v-7" fill={A} />
      <ellipse cx="24" cy="26" rx="20" ry="11" fill={W} />
      <ellipse cx="24" cy="26" rx="12" ry="5.6" fill="#4ade80" stroke={D} strokeWidth="2" />
      <path d="M10 15V5M38 15V5" {...line(2.4)} />
      <path d="M10 5l6 2.5-6 2.5M38 5l6 2.5-6 2.5" fill={W} />
    </>
  ),
  satellite: (
    <>
      <g transform="rotate(-45 22 22)">
        <rect x="2" y="17" width="13" height="10" rx="1.5" fill={W} />
        <rect x="29" y="17" width="13" height="10" rx="1.5" fill={W} />
        <path d="M15 22h14" {...line(2.4)} />
        <rect x="17" y="13" width="10" height="18" rx="3" fill={W} />
        <path d="M8.5 17v10M35.5 17v10" {...line(1.8, D)} />
        <circle cx="22" cy="19" r="2" fill={D} />
      </g>
      <path d="M33 41a10 10 0 0 0 8-8M30 46a16 16 0 0 0 16-16" {...line(2.8, A)} />
    </>
  ),
  graduation: (
    <>
      <path d="M11 22v10c0 4 6 7 13 7s13-3 13-7V22l-13 6z" fill={A} />
      <path d="M24 7L2 17l22 10 22-10z" fill={W} />
      <path d="M42 19v13" {...line(2.6)} />
      <circle cx="42" cy="34" r="2.8" fill={GOLD} />
      <path d="M24 17l18 2" {...line(2, D)} />
    </>
  ),
  calendar: (
    <>
      <rect x="6" y="9" width="36" height="34" rx="5" fill={W} />
      <path d="M6 14a5 5 0 0 1 5-5h26a5 5 0 0 1 5 5v5H6z" fill={D} />
      <path d="M15 5v8M33 5v8" {...line(3.6)} />
      {[26, 34].map((y) =>
        [14, 21, 28, 35].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.3" fill={D} />),
      )}
    </>
  ),
  id_card: (
    <>
      <rect x="4" y="10" width="40" height="28" rx="4" fill={W} />
      <circle cx="15" cy="21" r="5" fill={D} />
      <path d="M7.5 33c1-4.5 4-6.5 7.5-6.5s6.5 2 7.5 6.5z" fill={D} />
      <path d="M27 19h11M27 25h11M27 31h7" {...line(2.6, D)} />
    </>
  ),
  document: (
    <>
      <path d="M10 4h19l9 9v31H10z" fill={W} strokeLinejoin="round" />
      <path d="M29 4v9h9z" fill={A} />
      <path d="M15 20h18M15 26h18M15 32h12" {...line(2.6, D)} />
    </>
  ),
  police_badge: (
    <>
      <path d="M24 3l5 7.5 9-1-1 9 8 5.5-8 5.5 1 9-9-1-5 7.5-5-7.5-9 1 1-9-8-5.5 8-5.5-1-9 9 1z" fill={W} />
      <circle cx="24" cy="24" r="9.5" fill={D} />
      <Star cx={24} cy={24.5} r={6} fill={W} />
    </>
  ),
  scroll: (
    <>
      <rect x="10" y="7" width="28" height="34" fill={W} />
      <rect x="6" y="4" width="36" height="7" rx="3.5" fill={A} />
      <rect x="6" y="37" width="36" height="7" rx="3.5" fill={A} />
      <path d="M15 17h18M15 23h18M15 29h12" {...line(2.4, D)} />
    </>
  ),
  stamp: (
    <>
      <rect x="5" y="37" width="38" height="7" rx="2" fill={A} />
      <path d="M19 4h10v8c0 3 2 5 5 7H14c3-2 5-4 5-7z" fill={W} />
      <rect x="8" y="20" width="32" height="12" rx="3" fill={W} />
      <path d="M13 26h22" {...line(2.4, D)} />
    </>
  ),
  percent: (
    <>
      <path d="M38 9L10 39" {...line(5)} />
      <circle cx="14" cy="14" r="7" fill={W} />
      <circle cx="34" cy="34" r="7" fill={W} />
      <circle cx="14" cy="14" r="3" fill={D} />
      <circle cx="34" cy="34" r="3" fill={D} />
    </>
  ),
  code: (
    <>
      <path d="M27 8l-6 32" {...line(4.4, A)} />
      <path d="M16 12L5 24l11 12M32 12l11 12-11 12" {...line(5)} />
    </>
  ),
  lock: (
    <>
      <path d="M15 21v-6a9 9 0 0 1 18 0v6" {...line(4.4)} />
      <rect x="9" y="20" width="30" height="24" rx="5" fill={W} />
      <circle cx="24" cy="30" r="3.6" fill={D} />
      <path d="M24 31v6" {...line(3, D)} />
    </>
  ),
  gavel: (
    <>
      <rect x="22" y="38" width="22" height="6" rx="2" fill={A} />
      <g transform="rotate(-40 22 18)">
        <rect x="18.5" y="16" width="6" height="28" rx="3" fill={W} />
        <rect x="9" y="6" width="26" height="12" rx="3" fill={W} />
        <path d="M14 6v12M30 6v12" stroke={D} strokeWidth="2.4" />
      </g>
    </>
  ),
  vault: (
    <>
      <path d="M11 40v4M37 40v4" {...line(4)} />
      <rect x="5" y="5" width="38" height="35" rx="5" fill={W} />
      <circle cx="24" cy="22.5" r="10" fill={D} />
      <circle cx="24" cy="22.5" r="4" fill={W} />
      <path d="M24 12.5v3.5M24 29v3.5M14 22.5h3.5M30.5 22.5H34" {...line(2.4)} />
      <path d="M38 18v9" {...line(2.6, D)} />
    </>
  ),
  wallet: (
    <>
      <path d="M8 13l23-8 3 8" fill={A} />
      <path d="M8 12h28a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H8a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill={W} />
      <rect x="29" y="22" width="15" height="11" rx="3" fill={D} />
      <circle cx="35" cy="27.5" r="2.2" fill={W} />
    </>
  ),
  bug: (
    <>
      <path
        d="M13 22l-7-4M13 30H4M13 37l-7 4M35 22l7-4M35 30h9M35 37l7 4M21 9l-3-5M27 9l3-5"
        {...line(2.6)}
      />
      <circle cx="24" cy="13" r="6" fill={W} />
      <ellipse cx="24" cy="29" rx="11" ry="14" fill={W} />
      <path d="M24 17v25" stroke={D} strokeWidth="2.4" />
      <circle cx="19" cy="26" r="2.2" fill={D} />
      <circle cx="29" cy="33" r="2.6" fill={D} />
    </>
  ),
  box: (
    <>
      <path d="M6 15l18-8 18 8v21l-18 8-18-8z" fill={W} />
      <path d="M6 15l18 8 18-8M24 23v21" {...line(2.4, D)} />
      <path d="M15 11l18 8v6" {...line(2.6, A)} />
    </>
  ),
  umbrella: (
    <>
      <path d="M24 24v14a4 4 0 0 1-8 0" {...line(3.4)} />
      <path
        d="M4 24C4 13 13 5 24 5s20 8 20 19c-3-3-7-3-10 0-3-3-7-3-10 0-3-3-7-3-10 0-3-3-7-3-10 0z"
        fill={W}
      />
      <path d="M24 5c-5 5-7 12-7 19M24 5c5 5 7 12 7 19" {...line(2, D)} />
    </>
  ),
  flag: (
    <>
      <path d="M10 4v40" {...line(4)} />
      <path d="M12 7c8-4 14 4 30 0v21c-16 4-22-4-30 0z" fill={W} />
      <Paw x={19} y={8} s={0.62} fill={D} />
    </>
  ),
  crown: (
    <>
      <path d="M5 16l10 9 9-15 9 15 10-9-4 22H9z" fill={W} strokeLinejoin="round" />
      <rect x="9" y="38" width="30" height="5" rx="2" fill={A} />
      <circle cx="24" cy="28" r="3.2" fill={D} />
      <circle cx="15" cy="31" r="2.2" fill={D} />
      <circle cx="33" cy="31" r="2.2" fill={D} />
      <circle cx="5" cy="15" r="2.8" fill={W} />
      <circle cx="43" cy="15" r="2.8" fill={W} />
      <circle cx="24" cy="8" r="2.8" fill={W} />
    </>
  ),
  laser: (
    <>
      <path d="M22 26L37 11" stroke="#ff8fa0" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M7 41l15-15" {...line(8)} />
      <path d="M17 31l3-3" {...line(2.4, D)} />
      <circle cx="39" cy="9" r="5" fill={RED} stroke={W} strokeWidth="2.2" />
    </>
  ),
  yarn: (
    <>
      <path d="M33 33c4 4 6.5 4 9 2s4 2 4 6" {...line(2.6)} />
      <circle cx="22" cy="22" r="16" fill={W} />
      <path
        d="M9 14c8 2 16 10 18 22M13 8c10 3 17 12 20 22M7 22c6 2 12 8 13 15M20 6c6 4 12 8 16 14"
        {...line(2.2, D)}
      />
    </>
  ),
  fish: (
    <>
      <path d="M3 24c7-10 20-12 31-4l9-7v22l-9-7C23 36 10 34 3 24z" fill={W} />
      <circle cx="11" cy="22" r="2.4" fill={D} />
      <path d="M19 17c2.4 4.5 2.4 9.5 0 14M25 18c2 4 2 8 0 12" {...line(2.4, D)} />
    </>
  ),
  leaf: (
    <>
      <path d="M8 40C8 18 22 6 42 6c0 20-12 34-34 34z" fill={W} />
      <path d="M8 40L32 16M18 30h8M24 24v-7" {...line(2.6, D)} />
    </>
  ),
  moon: (
    <>
      <path d="M30 4a20 20 0 1 0 14 26A16 16 0 0 1 30 4z" fill={W} />
      <circle cx="17" cy="29" r="3" fill={D} opacity="0.6" />
      <circle cx="24" cy="36" r="2" fill={D} opacity="0.6" />
      <Sparkle cx={39} cy={12} r={5} fill={A} />
    </>
  ),
  post: (
    <>
      <path d="M31 11c3 3 3 7 1 11" {...line(2.2, A)} />
      <circle cx="32" cy="24" r="3" fill={GOLD} />
      <rect x="18" y="10" width="12" height="29" fill={W} />
      <path d="M18 15l12 3M18 21l12 3M18 27l12 3M18 33l12 3" stroke={D} strokeWidth="2.2" />
      <rect x="10" y="5" width="28" height="6" rx="2" fill={W} />
      <rect x="6" y="38" width="36" height="6" rx="2" fill={W} />
    </>
  ),
  aquarium: (
    <>
      <rect x="5" y="9" width="38" height="31" rx="4" fill={A} />
      <path d="M5 17h38v19a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill={W} />
      <path d="M13 28c3-4 8-4 11 0-3 4-8 4-11 0zM24 28l4-3v6z" fill={D} />
      <circle cx="33" cy="23" r="1.8" fill={D} />
      <circle cx="36" cy="29" r="1.3" fill={D} />
      <path d="M32 40c0-4 2-6 4-8M38 40c0-3-1-5-2-6" {...line(1.8, D)} />
      <rect x="3" y="40" width="42" height="4" rx="2" fill={W} />
    </>
  ),
  window: (
    <>
      <rect x="7" y="4" width="34" height="35" rx="4" fill={W} />
      <rect x="11" y="8" width="12" height="13" rx="1" fill={D} />
      <rect x="25" y="8" width="12" height="13" rx="1" fill={D} />
      <rect x="11" y="23" width="12" height="12" rx="1" fill={D} />
      <rect x="25" y="23" width="12" height="12" rx="1" fill={D} />
      <circle cx="31" cy="14" r="3" fill={GOLD} />
      <rect x="4" y="39" width="40" height="5" rx="2" fill={W} />
    </>
  ),
  can: (
    <>
      <ellipse cx="24" cy="36" rx="15" ry="6" fill={W} />
      <rect x="9" y="15" width="30" height="21" fill={W} />
      <rect x="9" y="21" width="30" height="10" fill={D} />
      <ellipse cx="24" cy="15" rx="15" ry="6" fill={A} stroke={W} strokeWidth="2.2" />
      <path d="M16 26c2.6-3 6.4-3 9 0-2.6 3-6.4 3-9 0zM25 26l3.4-2.2v4.4z" fill={W} />
    </>
  ),
  mouse: (
    <>
      <path d="M7 34c-3 0-4.5 3-2.5 5s1 6-2 6" {...line(2.4)} />
      <path d="M20 18v-6" {...line(3)} />
      <ellipse cx="16.5" cy="8" rx="3.5" ry="2.6" {...line(2.4)} />
      <ellipse cx="23.5" cy="8" rx="3.5" ry="2.6" {...line(2.4)} />
      <circle cx="33" cy="20" r="5.5" fill={A} />
      <path d="M6 36c0-11 8-18 18-18 8.5 0 14.5 6 16.5 13l4 1.5-2 3.5H6z" fill={W} />
      <circle cx="36" cy="28" r="2" fill={D} />
      <path d="M12 36h20" {...line(2.2, D)} />
    </>
  ),
  cup: (
    <>
      <path d="M16 5c-2 3 2 5 0 8M24 5c-2 3 2 5 0 8" {...line(2.6, A)} />
      <path d="M34 21h3a5 5 0 0 1 0 10h-4M4 44h34" {...line(3.4)} />
      <path d="M8 17h26v13a10 10 0 0 1-10 10h-6A10 10 0 0 1 8 30z" fill={W} />
      <Paw x={14} y={20} s={0.58} fill={D} />
    </>
  ),
  medkit: (
    <>
      <path d="M18 12V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" {...line(3)} />
      <rect x="5" y="12" width="38" height="29" rx="5" fill={W} />
      <path d="M24 19v15M16.5 26.5h15" {...line(5.4, RED)} />
    </>
  ),
  bell: (
    <>
      <path d="M4 26c4-1 6 2 10 1M44 26c-4-1-6 2-10 1" {...line(2.2, A)} />
      <circle cx="24" cy="5" r="2.6" fill={W} />
      <path d="M24 7a12 12 0 0 1 12 12v8l4 8H8l4-8v-8A12 12 0 0 1 24 7z" fill={W} />
      <circle cx="24" cy="39" r="4" fill={W} />
      <path d="M9 34h30" stroke={D} strokeWidth="2.4" />
      <path d="M17 17a7 7 0 0 1 5-5" {...line(2.4, D)} />
    </>
  ),
  milk: (
    <>
      <path d="M18 3h12v7l5 8v22a4 4 0 0 1-4 4H17a4 4 0 0 1-4-4V18l5-8z" fill={W} />
      <path d="M18 10h12" {...line(2.4, D)} />
      <rect x="13" y="23" width="22" height="12" fill={D} />
      <path d="M24 25.5c2 3 3 4.2 3 5.6a3 3 0 0 1-6 0c0-1.4 1-2.6 3-5.6z" fill={W} />
    </>
  ),
  sun: (
    <>
      <path d={rays(24, 24, 13.5, 20, 8)} {...line(3.6)} />
      <circle cx="24" cy="24" r="10" fill={W} />
      <circle cx="24" cy="24" r="5" fill={GOLD} />
    </>
  ),
  gear: (
    <>
      <path d={gearPath(24, 24, 20, 15, 9)} fill={W} strokeLinejoin="round" />
      <circle cx="24" cy="24" r="7" fill={D} />
      <circle cx="24" cy="24" r="3" fill={W} />
    </>
  ),
  lucky_cat: (
    <>
      <path d="M33 23l3.5-13a3.2 3.2 0 0 1 6.2 1.6L39 25z" fill={W} />
      <path d="M11 45V29c0-7.5 5.5-12.5 13-12.5S37 21.5 37 29v16z" fill={W} />
      <path
        d="M12 19l3-10 6.5 6h5L33 9l3 10c1 6.5-4.5 11-12 11S11 25.5 12 19z"
        fill={W}
        stroke={D}
        strokeWidth="1.2"
      />
      <ellipse cx="19.5" cy="20" rx="1.6" ry="2.2" fill={D} />
      <ellipse cx="28.5" cy="20" rx="1.6" ry="2.2" fill={D} />
      <path d="M14 31h20" {...line(3, RED)} />
      <circle cx="24" cy="35" r="4" fill={GOLD} stroke={D} strokeWidth="1.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="24" cy="24" r="19" fill={W} />
      <path d={rays(24, 24, 14.5, 16.5, 12)} {...line(2.2, D)} />
      <path d="M24 12v12l8 5" {...line(3.6, D)} />
      <circle cx="24" cy="24" r="2.4" fill={D} />
    </>
  ),
  chest: (
    <>
      <path d="M6 22c0-8 8-13 18-13s18 5 18 13z" fill={W} />
      <rect x="6" y="22" width="36" height="20" rx="2" fill={W} />
      <path d="M6 22h36M14 11v31M34 11v31" stroke={D} strokeWidth="2.6" />
      <rect x="20" y="18.5" width="8" height="9" rx="2" fill={GOLD} stroke={D} strokeWidth="2" />
      <Sparkle cx={41} cy={7} r={4.5} fill={A} />
    </>
  ),
  dragon: (
    <>
      <path d="M18 14l-5-10 10 8M27 12l2.5-9.5 4 10.5" fill={W} />
      <path d="M40 30c3 1 5.5 4.5 4.5 8.5-2-2-4.5-2-6.5-1 1-2.5 1-5 2-7.5z" fill="#ffb05e" />
      <path d="M5 44c0-17 8-32 21-32 6 0 10 3 12 7l6 3-2 5.5-6-1.2c-2 6-8 10-16 10l-3 7.7z" fill={W} />
      <circle cx="28" cy="20" r="2.4" fill={D} />
      <path d="M13 31c3 2 7 2 10 0M11 37c3 2 6 2 9 0" {...line(2.2, D)} />
      <path d="M38 25l3 .8" {...line(2, D)} />
    </>
  ),
  bowl: (
    <>
      <path d="M4 22h40c0 10-8 18-20 18S4 32 4 22z" fill={W} />
      <ellipse cx="24" cy="22" rx="20" ry="4" fill={A} />
      <path d="M10 21c2-4 6-5 9-3 2-3 7-3 9 0 3-2 7-1 9 3z" fill={D} />
      <Paw x={17.5} y={25} s={0.55} fill={D} />
    </>
  ),
  whiskers: (
    <>
      <path d="M16 20L3 14M16 24H2M16 28L3 33M32 20l13-6M32 24h14M32 28l13 5" {...line(2.6)} />
      <path d="M18 18h12l-6 6z" fill={W} />
      <path d="M24 24v5M24 29c-2 3-5 3-7.5 1M24 29c2 3 5 3 7.5 1" {...line(2.6)} />
      <Sparkle cx={40} cy={8} r={4.5} fill={GOLD} />
    </>
  ),
  castle: (
    <>
      <path d="M24 9V2l6 2.5L24 7" fill={W} />
      <path d="M4 44V14h3v3h3v-3h3v3h3v-3h3v10h10V14h3v3h3v-3h3v3h3v-3h3v30zM19 24V9h3v3h4V9h3v15" fill={W} />
      <path d="M19.5 44v-9a4.5 4.5 0 0 1 9 0v9z" fill={D} />
      <rect x="9.5" y="25" width="3" height="6" rx="1.5" fill={D} />
      <rect x="35.5" y="25" width="3" height="6" rx="1.5" fill={D} />
    </>
  ),
  pumpkin: (
    <>
      <path d="M24 12c0-4 2-7 6-8" {...line(3.6)} />
      <path
        d="M24 12c-4-1-9 0-13 3S4 24 4 29s4 12 10 13c4 1 7 0 10-1 3 1 6 2 10 1 6-1 10-7 10-13s-3-11-7-14-9-4-13-3z"
        fill={W}
      />
      <path
        d="M24 13c-4 6-4 21 0 28M24 13c4 6 4 21 0 28M13 16c-3 7-3 17 1 25M35 16c3 7 3 17-1 25"
        {...line(2.2, D)}
      />
    </>
  ),
  tree: (
    <>
      <rect x="21" y="39" width="6" height="6" rx="1" fill={A} />
      <path d="M24 6L12 19h6L8 31h8L6 41h36L32 31h8L30 19h6z" fill={W} strokeLinejoin="round" />
      <circle cx="19" cy="25" r="2.2" fill={RED} />
      <circle cx="29" cy="32" r="2.2" fill={D} />
      <circle cx="17" cy="36" r="2.2" fill={GOLD} />
      <circle cx="27" cy="19" r="2" fill={GOLD} />
      <Star cx={24} cy={6} r={5} fill={GOLD} />
    </>
  ),
  envelope: (
    <>
      <rect x="4" y="10" width="40" height="29" rx="4" fill={W} />
      <path d="M5 12l19 14 19-14M5 37l14-12M43 37L29 25" {...line(2.6, D)} />
    </>
  ),
  flower: (
    <>
      <path d="M24 30v14M24 38c-4 0-8-2-9-6 4 0 7 2 9 6z" {...line(3)} />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="24" cy="12" rx="6" ry="8.5" fill={W} transform={`rotate(${a} 24 21)`} />
      ))}
      <circle cx="24" cy="21" r="6" fill={GOLD} stroke={D} strokeWidth="2" />
    </>
  ),
  snowflake: (
    <>
      <path d={rays(24, 24, 0, 20, 6, Math.PI / 2)} {...line(3.4)} />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d="M24 10l-5-5M24 10l5-5" {...line(2.6)} transform={`rotate(${a} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="4" fill={D} stroke={W} strokeWidth="2.4" />
    </>
  ),
  cake: (
    <>
      <path d="M18 24v-8M30 24v-8" {...line(3)} />
      <ellipse cx="18" cy="11.5" rx="2.4" ry="3.4" fill={GOLD} />
      <ellipse cx="30" cy="11.5" rx="2.4" ry="3.4" fill={GOLD} />
      <rect x="7" y="24" width="34" height="18" rx="3" fill={W} />
      <path d="M7 30c4 3 8 3 11.3 0 3.4 3 7.4 3 11.3 0 3.4 3 7.4 3 11.4 0" {...line(2.6, D)} />
      <rect x="3" y="42" width="42" height="3" rx="1.5" fill={A} />
    </>
  ),
  bull: (
    <>
      <path d="M14 17C8 17 4 13 3 7M34 17c6 0 10-4 11-10" {...line(4)} />
      <path d="M12 15h24l-2 15c-1 7-5 12-10 12s-9-5-10-12z" fill={W} />
      <ellipse cx="24" cy="35" rx="7.5" ry="5" fill={D} />
      <circle cx="21.2" cy="35" r="1.4" fill={W} />
      <circle cx="26.8" cy="35" r="1.4" fill={W} />
      <circle cx="18" cy="23" r="2.2" fill={D} />
      <circle cx="30" cy="23" r="2.2" fill={D} />
    </>
  ),
  gift: (
    <>
      <path
        d="M24 17c-3-6-12-10-13-4-1 4 8 4 13 4zM24 17c3-6 12-10 13-4 1 4-8 4-13 4z"
        fill={A}
        stroke={W}
        strokeWidth="2"
      />
      <rect x="6" y="17" width="36" height="9" rx="2" fill={W} />
      <rect x="9" y="26" width="30" height="17" rx="2" fill={W} />
      <path d="M24 17v26" stroke={D} strokeWidth="5" />
    </>
  ),
  mooncake: (
    <>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI / 6) * i;
        return <circle key={i} cx={24 + 16 * Math.cos(a)} cy={24 + 16 * Math.sin(a)} r="4" fill={W} />;
      })}
      <circle cx="24" cy="24" r="17" fill={W} />
      <circle cx="24" cy="24" r="12" {...line(2, D)} />
      <Paw x={16} y={15.5} s={0.68} fill={D} />
    </>
  ),
  mask: (
    <>
      <path d="M38 15c0-6 3-11 8-12-1 5-3 9-8 12z" fill={A} />
      <path d="M8 31l-3 12" {...line(2.6)} />
      <path
        d="M4 16c6-3 13-3 20 1 7-4 14-4 20-1 0 10-5 17-11 17-4 0-6-3-9-6-3 3-5 6-9 6C9 33 4 26 4 16z"
        fill={W}
      />
      <ellipse cx="15" cy="22" rx="4.6" ry="3.2" fill={D} />
      <ellipse cx="33" cy="22" rx="4.6" ry="3.2" fill={D} />
    </>
  ),
  fireworks: (
    <>
      <path d={rays(19, 19, 5, 15, 8)} {...line(3)} />
      <path d={rays(35, 33, 3, 10, 8, Math.PI / 8)} {...line(2.6, A)} />
      <circle cx="19" cy="19" r="3" fill={GOLD} />
      <circle cx="35" cy="33" r="2.4" fill={W} />
      <circle cx="8" cy="40" r="2" fill={W} />
      <circle cx="42" cy="12" r="2" fill={GOLD} />
    </>
  ),
  torch: (
    <>
      <path d="M24 2c5 5 8 9 8 12a8 8 0 0 1-16 0c0-3 3-7 8-12z" fill="#ffb05e" />
      <path d="M24 8c2 3 4 5 4 7a4 4 0 0 1-8 0c0-2 2-4 4-7z" fill={GOLD} />
      <rect x="14" y="20" width="20" height="5" rx="2" fill={A} />
      <path d="M17 25h14l-4 20h-6z" fill={W} />
      <path d="M21 31h6" {...line(2.2, D)} />
    </>
  ),
  bag: (
    <>
      <path d="M17 17v-4a7 7 0 0 1 14 0v4" {...line(3.4)} />
      <path d="M8 15h32l2.5 28h-37z" fill={W} strokeLinejoin="round" />
      <circle cx="17" cy="22" r="2" fill={D} />
      <circle cx="31" cy="22" r="2" fill={D} />
    </>
  ),
  trophy: (
    <>
      <path d="M14 10H7c0 7 3 11 8 11M34 10h7c0 7-3 11-8 11" {...line(3.4)} />
      <path d="M14 5h20v13a10 10 0 0 1-20 0z" fill={W} />
      <rect x="21" y="27" width="6" height="8" fill={W} />
      <rect x="14" y="34" width="20" height="9" rx="2" fill={W} />
      <Star cx={24} cy={15} r={5.6} fill={D} />
      <path d="M19 38.5h10" {...line(2.2, D)} />
    </>
  ),
  eye: (
    <>
      <path d="M2 24c5-9 13-14 22-14s17 5 22 14c-5 9-13 14-22 14S7 33 2 24z" fill={W} />
      <circle cx="24" cy="24" r="9.5" fill={GOLD} />
      <ellipse cx="24" cy="24" rx="2.6" ry="8" fill={D} />
    </>
  ),
};

/** Значки в углу карточки: рисунок в круге, сетка 24×24, цвет — currentColor. */
const B = 'currentColor';
const bl = (width: number) =>
  ({ stroke: B, strokeWidth: width, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }) as const;

export const BADGE_ICONS: Record<Exclude<CardIconBadge, 'none'>, ReactNode> = {
  up: <path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" {...bl(3)} />,
  plus: <path d="M12 5v14M5 12h14" {...bl(3.2)} />,
  check: <path d="M5.5 12.5l4.2 4.2 8.8-9" {...bl(3.2)} />,
  star: <Star cx={12} cy={12.6} r={8.4} fill={B} />,
  heart: (
    <path d="M12 20s-8-4.8-8-10.5A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8 2.5C20 15.2 12 20 12 20z" fill={B} />
  ),
  coin: (
    <>
      <circle cx="12" cy="12" r="8" fill={GOLD} stroke={B} strokeWidth="1.6" />
      <path d="M12 8v8" {...bl(2)} />
    </>
  ),
  crown: <path d="M4 8l4 4 4-6 4 6 4-4-1.6 10H5.6z" fill={B} strokeLinejoin="round" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8" {...bl(2)} />
      <path d="M4 12h16M12 4c-3 3-3 13 0 16M12 4c3 3 3 13 0 16" {...bl(1.6)} />
    </>
  ),
  chat: (
    <path
      d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
      fill={B}
    />
  ),
  lock: (
    <>
      <path d="M8 11V8a4 4 0 0 1 8 0v3" {...bl(2.4)} />
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" fill={B} />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" {...bl(2.2)} />
      <path d="M12 7.5V12l3 2" {...bl(2.2)} />
    </>
  ),
  fire: <path d="M12 3c4 4 7 7 7 11a7 7 0 0 1-14 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-5 2-8z" fill={B} />,
  paw: <Paw x={1.5} y={1.5} s={0.875} fill={B} />,
  sparkle: <Sparkle cx={12} cy={12} r={9} fill={B} />,
  trophy: (
    <>
      <path d="M7 4h10v6a5 5 0 0 1-10 0z" fill={B} />
      <path d="M7 6H4c0 3 1.5 5 4 5M17 6h3c0 3-1.5 5-4 5M12 15v3M8 20h8" {...bl(2)} />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12c2.5-4.5 6-7 9.5-7s7 2.5 9.5 7c-2.5 4.5-6 7-9.5 7s-7-2.5-9.5-7z" fill={B} />
      <circle cx="12" cy="12" r="3" fill="#fff" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="12" r="4.5" {...bl(2.4)} />
      <path d="M12.5 12H21M18 12v3.5M21 12v2.5" {...bl(2.4)} />
    </>
  ),
  moon: <path d="M15 3.5a8.5 8.5 0 1 0 5.5 11.5A7 7 0 0 1 15 3.5z" fill={B} />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4.6" fill={B} />
      <path d={rays(12, 12, 7.4, 10, 8)} {...bl(2)} />
    </>
  ),
  snow: (
    <>
      <path d={rays(12, 12, 0, 9, 6, Math.PI / 2)} {...bl(2.2)} />
      <circle cx="12" cy="12" r="2" fill={B} />
    </>
  ),
  bolt: <path d="M13.5 2.5L5 13.5h6l-1.5 8 9-11h-6z" fill={B} strokeLinejoin="round" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3.6" fill={B} />
      <path d="M2.5 20c0-4 2.8-6.5 6.5-6.5s6.5 2.5 6.5 6.5z" fill={B} />
      <circle cx="16.5" cy="9" r="3" fill={B} opacity="0.65" />
      <path d="M16 14c3.2 0 5.5 2.2 5.5 6H17" fill={B} opacity="0.65" />
    </>
  ),
  music: (
    <>
      <path d="M9 17V6l10-2v11" {...bl(2.2)} />
      <circle cx="7" cy="17.5" r="2.6" fill={B} />
      <circle cx="17" cy="15.5" r="2.6" fill={B} />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" fill={B} strokeLinejoin="round" />,
  pen: (
    <>
      <path d="M15.5 4.5l4 4L9 19l-5 1 1-5z" fill={B} strokeLinejoin="round" />
      <path d="M13.5 6.5l4 4" stroke="#fff" strokeWidth="1.4" />
    </>
  ),
  zzz: <path d="M4 6h6l-6 7h6M13 11h4.5L13 16h4.5M17 3.5h3.5L17 7.5h3.5" {...bl(2)} />,
  diamond: (
    <>
      <path d="M7 4h10l4 5-9 11L3 9z" fill={B} strokeLinejoin="round" />
      <path d="M3 9h18M9.5 4L12 9l2.5-5" stroke="#fff" strokeWidth="1.2" fill="none" />
    </>
  ),
  spiral: (
    <path
      d="M12 12.5a1.5 1.5 0 0 1 3 0 3 3 0 0 1-3 3 4.5 4.5 0 0 1-4.5-4.5A6 6 0 0 1 13.5 5a7.5 7.5 0 0 1 7.5 7.5"
      {...bl(2.2)}
    />
  ),
  bubble: (
    <>
      <circle cx="9" cy="14" r="5" {...bl(2)} />
      <circle cx="17" cy="7.5" r="3" {...bl(2)} />
      <circle cx="17.5" cy="17" r="1.8" fill={B} />
    </>
  ),
  nine: (
    <text x="12" y="17.5" textAnchor="middle" fontSize="16" fontWeight="900" fill={B} fontFamily="inherit">
      9
    </text>
  ),
  percent: (
    <>
      <path d="M18 5L6 19" {...bl(2.4)} />
      <circle cx="7.5" cy="7.5" r="2.6" {...bl(2)} />
      <circle cx="16.5" cy="16.5" r="2.6" {...bl(2)} />
    </>
  ),
  x2: (
    <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="900" fill={B} fontFamily="inherit">
      ×2
    </text>
  ),
};
