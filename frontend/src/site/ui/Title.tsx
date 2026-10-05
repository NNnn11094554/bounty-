import type { CSSProperties } from 'react';

interface Props {
  text: string;
  className?: string;
  style?: CSSProperties;
  /** буквы по отдельности — для проявления по одной (имя кота) */
  letters?: boolean;
}

/**
 * Заголовок, который не рвёт слова: каждое слово — без переноса, перенос только между словами.
 * Размер шрифта ограничен шириной панели и самым длинным словом (--chars): «Кристальный» и
 * «криптоимперию» помещаются целиком и на телефоне.
 */
export function Title({ text, className = '', style, letters = false }: Props) {
  const words = text.split(' ');
  const offsets = words.map((_, w) => words.slice(0, w).reduce((n, word) => n + word.length, 0));
  const chars = Math.max(...words.map((w) => w.length));
  return (
    <h2
      className={className}
      style={{ ...style, ['--chars' as string]: chars }}
      aria-label={letters ? text : undefined}
    >
      {words.map((word, w) => (
        <span key={w}>
          {w > 0 && ' '}
          <span className="word" aria-hidden={letters || undefined}>
            {letters
              ? word.split('').map((ch, i) => (
                  <span key={i} className="letter" style={{ ['--k' as string]: offsets[w]! + i }}>
                    {ch}
                  </span>
                ))
              : word}
          </span>
        </span>
      ))}
    </h2>
  );
}
