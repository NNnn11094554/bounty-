import {
  CARD_BADGE_LABELS,
  CARD_PALETTES,
  isTextBadge,
  parseCardIcon,
  type CardIconSpec,
} from '@meowgul/shared';
import { memo, useId, type ReactNode } from 'react';
import { BADGE_ICONS, GLYPHS } from './glyphs';

const CHARACTER_SRC = '/assets/generated/character-256.webp';

/** Серый вид закрытой карточки. Картинку персонажа не перекрашиваем никогда. */
function mutedStyle(muted: boolean | undefined, spec: CardIconSpec) {
  return muted && spec.glyph !== 'character' ? { filter: 'grayscale(0.85) brightness(0.8)' } : undefined;
}

function useSvgId(): string {
  return `ci${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
}

function Glyph({ spec, clipId }: { spec: CardIconSpec; clipId: string }) {
  if (spec.glyph === 'character') {
    // персонаж — готовая картинка без изменений, только круглая маска и обводка
    return (
      <>
        <clipPath id={clipId}>
          <circle cx="24" cy="24" r="20" />
        </clipPath>
        <circle cx="24" cy="24" r="22" fill="rgba(255,255,255,0.9)" />
        <image
          href={CHARACTER_SRC}
          x="4"
          y="4"
          width="40"
          height="40"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      </>
    );
  }
  // монеты токенов рисует TokenCoin
  if (spec.glyph === 'token') return null;
  return <>{GLYPHS[spec.glyph]}</>;
}

/** Значок в углу: пиктограмма в белом круге или надпись на плашке. Координаты — в сетке 64×64. */
function Badge({ spec, dark }: { spec: CardIconSpec; dark: string }): ReactNode {
  if (spec.badge === 'none') return null;
  if (isTextBadge(spec.badge)) {
    const label = CARD_BADGE_LABELS[spec.badge] ?? spec.badge;
    const width = 9 + label.length * 6.4;
    return (
      <g>
        <rect
          x={61 - width}
          y="45"
          width={width}
          height="15"
          rx="7.5"
          fill="#fff"
          stroke={dark}
          strokeOpacity="0.25"
        />
        <text
          x={61 - width / 2}
          y="56.2"
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="900"
          fill={dark}
          fontFamily="inherit"
        >
          {label}
        </text>
      </g>
    );
  }
  return (
    <g>
      <circle cx="51" cy="51" r="11" fill="#fff" />
      <g transform="translate(42.6 42.6) scale(0.7)" color={dark}>
        {BADGE_ICONS[spec.badge]}
      </g>
    </g>
  );
}

/** Размер тикера на монете: короткие — крупно, длинные — мельче, чтобы влезли в лицевую сторону. */
function tickerFont(ticker: string): number {
  return ticker.length <= 2
    ? 18
    : ticker.length === 3
      ? 16
      : ticker.length === 4
        ? 12.5
        : ticker.length === 5
          ? 10.2
          : 8.8;
}

/**
 * Монета токена в сетке 64×64: объёмный ребристый гурт, лицевая сторона с бликом и выпуклый тикер.
 * Своя стилизация в цветах палитры — никаких логотипов настоящих проектов.
 */
function TokenCoin({ spec, id }: { spec: CardIconSpec; id: string }) {
  const [light, dark] = CARD_PALETTES[spec.palette] ?? CARD_PALETTES[0];
  const ticker = spec.ticker ?? '?';
  const font = tickerFont(ticker);
  return (
    <>
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="36%" cy="30%" r="78%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="60" rx="19" ry="3.2" fill="#000" opacity="0.28" />
      {/* толщина монеты: тёмный край чуть ниже лицевой стороны */}
      <circle cx="32" cy="33.6" r="28.5" fill={dark} />
      <circle cx="32" cy="33.6" r="28.5" fill="#000" opacity="0.28" />
      <circle cx="32" cy="31" r="28.5" fill={`url(#${id}-rim)`} />
      <circle
        cx="32"
        cy="31"
        r="25.6"
        fill="none"
        stroke="#000"
        strokeOpacity="0.22"
        strokeWidth="2.4"
        strokeDasharray="1.3 2.1"
      />
      <circle cx="32" cy="31" r="28" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" />
      <circle cx="32" cy="31" r="22" fill={`url(#${id}-face)`} />
      <circle cx="32" cy="31" r="22" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" />
      <circle cx="32" cy="31" r="18.6" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="0.8" />
      <path
        d="M13.5 22.5 A21 21 0 0 1 40 10.6"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <text
        x="32"
        y={31 + font * 0.36 + 0.9}
        textAnchor="middle"
        fontSize={font}
        fontWeight="900"
        fill={dark}
        opacity="0.55"
        fontFamily="inherit"
        letterSpacing="-0.2"
      >
        {ticker}
      </text>
      <text
        x="32"
        y={31 + font * 0.36}
        textAnchor="middle"
        fontSize={font}
        fontWeight="900"
        fill="#fff"
        fontFamily="inherit"
        letterSpacing="-0.2"
        data-ticker={ticker}
      >
        {ticker}
      </text>
    </>
  );
}

interface Props {
  icon: string;
  size: number;
  className?: string;
  /** серый (карточка закрыта условием) */
  muted?: boolean;
}

/** Иконка актива: монета токена или градиентный фон палитры с белым рисунком и значком в углу. */
export const CardIcon = memo(function CardIcon({ icon, size, className, muted }: Props) {
  const id = useSvgId();
  const spec = parseCardIcon(icon);
  const [light, dark] = CARD_PALETTES[spec.palette] ?? CARD_PALETTES[0];
  if (spec.glyph === 'token') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className={className}
        style={mutedStyle(muted, spec)}
        aria-hidden
        data-icon={icon}
      >
        <TokenCoin spec={spec} id={id} />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={mutedStyle(muted, spec)}
      aria-hidden
      data-icon={icon}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="0.6" floodColor="#000" floodOpacity="0.22" />
        </filter>
      </defs>
      <rect width="64" height="64" rx="17" fill={`url(#${id}-bg)`} />
      <ellipse cx="22" cy="10" rx="24" ry="10" fill="#fff" opacity="0.16" />
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="16"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      <g transform="translate(8 7)" color={dark} filter={`url(#${id}-sh)`}>
        <Glyph spec={spec} clipId={`${id}-clip`} />
      </g>
      <Badge spec={spec} dark={dark} />
    </svg>
  );
});

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Иллюстрация особой карточки (Specials): широкий кадр со сценой вокруг рисунка. */
export const CardArt = memo(function CardArt({
  icon,
  seed,
  className,
  muted,
}: {
  icon: string;
  seed: string;
  className?: string;
  muted?: boolean;
}) {
  const id = useSvgId();
  const spec = parseCardIcon(icon);
  const [light, dark] = CARD_PALETTES[spec.palette] ?? CARD_PALETTES[0];
  const h = hash(seed);
  // россыпь лапок и искр — у каждой карточки своя, но стабильная
  const decor = Array.from({ length: 7 }, (_, i) => {
    const v = (h >>> (i * 4)) & 0xff;
    return {
      x: 10 + ((v * 37 + i * 53) % 140),
      y: 8 + ((v * 11 + i * 29) % 80),
      r: 3 + (v % 4),
      paw: (v + i) % 3 === 0,
      rot: ((v * 7) % 60) - 30,
    };
  }).filter((d) => Math.abs(d.x - 80) > 30 || Math.abs(d.y - 50) > 32);
  return (
    <svg
      viewBox="0 0 160 100"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      style={mutedStyle(muted, spec)}
      aria-hidden
      data-icon={icon}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="52%" r="50%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2.4" stdDeviation="1.2" floodColor="#000" floodOpacity="0.25" />
        </filter>
      </defs>
      <rect width="160" height="100" fill={`url(#${id}-bg)`} />
      <path
        d={`M80 52${Array.from({ length: 12 }, (_, i) => {
          const a1 = (Math.PI / 6) * i;
          const a2 = a1 + Math.PI / 14;
          return `L${80 + 120 * Math.cos(a1)} ${52 + 120 * Math.sin(a1)}L${80 + 120 * Math.cos(a2)} ${52 + 120 * Math.sin(a2)}L80 52`;
        }).join('')}`}
        fill="#fff"
        opacity="0.08"
      />
      <circle cx="80" cy="52" r="46" fill={`url(#${id}-glow)`} />
      {decor.map((d, i) =>
        d.paw ? (
          <g
            key={i}
            transform={`translate(${d.x} ${d.y}) rotate(${d.rot}) scale(${d.r / 8})`}
            fill="#fff"
            opacity="0.28"
          >
            <ellipse cx="0" cy="3" rx="5" ry="4.2" />
            <ellipse cx="-6" cy="-2" rx="2" ry="2.5" />
            <ellipse cx="-2.4" cy="-6" rx="2" ry="2.6" />
            <ellipse cx="2.4" cy="-6" rx="2" ry="2.6" />
            <ellipse cx="6" cy="-2" rx="2" ry="2.5" />
          </g>
        ) : (
          <circle key={i} cx={d.x} cy={d.y} r={d.r / 2.2} fill="#fff" opacity="0.4" />
        ),
      )}
      <ellipse cx="80" cy="90" rx="34" ry="5" fill="#000" opacity="0.18" />
      {spec.glyph === 'token' ? (
        <g transform="translate(48 18) scale(1)">
          <TokenCoin spec={spec} id={`${id}-coin`} />
        </g>
      ) : (
        <>
          <g transform="translate(46 16) scale(1.42)" color={dark} filter={`url(#${id}-sh)`}>
            <Glyph spec={spec} clipId={`${id}-clip`} />
          </g>
          <g transform="translate(96 36)">
            <Badge spec={spec} dark={dark} />
          </g>
        </>
      )}
    </svg>
  );
});
