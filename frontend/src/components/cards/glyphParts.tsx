/** Повторяющиеся детали рисунков карточек. */

/** Отпечаток лапы в квадрате 24×24, смещённый в (x, y) с масштабом s. */
export function Paw({ x, y, s, fill }: { x: number; y: number; s: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <ellipse cx="12" cy="15.6" rx="5.2" ry="4.4" />
      <ellipse cx="5.6" cy="10.4" rx="2.1" ry="2.6" transform="rotate(-18 5.6 10.4)" />
      <ellipse cx="9.4" cy="6.4" rx="2.1" ry="2.7" transform="rotate(-6 9.4 6.4)" />
      <ellipse cx="14.6" cy="6.4" rx="2.1" ry="2.7" transform="rotate(6 14.6 6.4)" />
      <ellipse cx="18.4" cy="10.4" rx="2.1" ry="2.6" transform="rotate(18 18.4 10.4)" />
    </g>
  );
}

export function Star({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + radius * Math.cos(a)).toFixed(2)},${(cy + radius * Math.sin(a)).toFixed(2)}`;
  });
  return <polygon points={points.join(' ')} fill={fill} strokeLinejoin="round" />;
}

export function Sparkle({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  const k = r * 0.28;
  return (
    <path
      d={`M${cx} ${cy - r}Q${cx + k} ${cy - k} ${cx + r} ${cy}Q${cx + k} ${cy + k} ${cx} ${cy + r}Q${cx - k} ${cy + k} ${cx - r} ${cy}Q${cx - k} ${cy - k} ${cx} ${cy - r}z`}
      fill={fill}
    />
  );
}
