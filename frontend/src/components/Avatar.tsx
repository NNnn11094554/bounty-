import { useState } from 'react';

interface Props {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}

const COLORS = ['#ff8a3d', '#2ed3c6', '#a66bff', '#4f9dff', '#ff4fa3', '#ffc93c'];

/** Аватар игрока: фото из Telegram или инициалы на цветном фоне. */
export function Avatar({ name, photoUrl, size = 36, className = '' }: Props) {
  const [broken, setBroken] = useState(false);
  const initials = name.trim().slice(0, 1).toUpperCase() || '?';
  const color = COLORS[(name.codePointAt(0) ?? 0) % COLORS.length];
  if (photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ring-2 ring-white/10 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-black text-night-900 ring-2 ring-white/10 ${className}`}
      style={{ width: size, height: size, background: color, fontSize: size * 0.44 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
