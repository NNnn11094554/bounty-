/** Иконки бустов в едином стиле: скруглённая плитка с градиентом и белой линией 2px. */
interface Props {
  size?: number;
}

function Tile({
  size = 56,
  from,
  to,
  children,
}: {
  size?: number;
  from: string;
  to: string;
  children: React.ReactNode;
}) {
  const id = `${from}${to}`.replace(/#/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden>
      <defs>
        <linearGradient id={`bt-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="52" height="52" rx="16" fill={`url(#bt-${id})`} />
      <rect
        x="2"
        y="2"
        width="52"
        height="52"
        rx="16"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.18"
        strokeWidth="1.5"
      />
      <ellipse cx="22" cy="12" rx="14" ry="5" fill="#fff" opacity="0.18" />
      {children}
    </svg>
  );
}

export function FullEnergyIcon({ size }: Props) {
  return (
    <Tile size={size} from="#ffd75e" to="#ff9f1c">
      <path
        d="M31 9 15 31h11l-3 16 18-24H30l1-14Z"
        fill="#fff"
        stroke="#b86a00"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </Tile>
  );
}

export function TurboIcon({ size }: Props) {
  return (
    <Tile size={size} from="#ff8a3d" to="#ff4f6d">
      <path
        d="M33 12c6-2 11 0 11 0s2 5 0 11c-2 6-8 12-13 15l-9-9c3-6 5-15 11-17Z"
        fill="#fff"
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="35" cy="21" r="3.2" fill="#ff5f6d" />
      <path d="M22 29l-7-2 4-6 6 .5M27 34l2 7 6-4-.5-6" fill="#ffe08a" />
      <path
        d="M17 37c-3 1-4 5-4 7 2 0 6-1 7-4"
        fill="#ffe08a"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Tile>
  );
}

export function MultitapIcon({ size }: Props) {
  return (
    <Tile size={size} from="#7b5cff" to="#2ed3c6">
      <g fill="#fff">
        <ellipse cx="28" cy="34" rx="8.5" ry="7.2" />
        <ellipse cx="17.5" cy="25.5" rx="3.4" ry="4.2" transform="rotate(-18 17.5 25.5)" />
        <ellipse cx="23.7" cy="19" rx="3.4" ry="4.4" transform="rotate(-6 23.7 19)" />
        <ellipse cx="32.3" cy="19" rx="3.4" ry="4.4" transform="rotate(6 32.3 19)" />
        <ellipse cx="38.5" cy="25.5" rx="3.4" ry="4.2" transform="rotate(18 38.5 25.5)" />
      </g>
      <path d="M44 9v8M40 13h8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path
        d="M10 44l4-3M46 44l-4-3"
        stroke="#fff"
        strokeOpacity=".7"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Tile>
  );
}

export function EnergyLimitIcon({ size }: Props) {
  return (
    <Tile size={size} from="#2ed39a" to="#1e8fd6">
      <rect x="13" y="17" width="27" height="22" rx="5" fill="none" stroke="#fff" strokeWidth="2.6" />
      <rect x="40.5" y="24" width="4" height="8" rx="1.5" fill="#fff" />
      <path
        d="M28.5 20.5 21 29.5h5.5l-1.5 6.5 8-9.5h-5.5l1-6Z"
        fill="#ffe08a"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </Tile>
  );
}
