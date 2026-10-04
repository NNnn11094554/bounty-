import type { CSSProperties, ReactNode } from 'react';
import type { SectionId } from '../content';
import { sectionIndex } from '../content';
import { k } from './reveal';

interface SectionProps {
  id: SectionId;
  /**
   * Раскладка на широком экране: колонка слева или справа (объект сцены — с другой стороны) или по
   * центру (заголовок сверху, содержимое снизу, объект — между ними). На телефоне всегда одна колонка:
   * заголовок, окно в сцену, содержимое.
   */
  layout: 'left' | 'right' | 'center';
  head?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** пустые места секции пропускают касания к сцене (тап по коту, свайп коллекции) */
  pass?: boolean;
}

/**
 * Секция страницы и её станция в 3D-сцене (data-station — по ней таймлайн ведёт камеру). Окно
 * (.sec-window) — место, где виден объект сцены: на телефоне — между заголовком и содержимым.
 */
export function Section({ id, layout, head, children, className = '', pass = false }: SectionProps) {
  return (
    <section
      id={id}
      data-station={sectionIndex(id)}
      className={`sec sec-${layout} ${pass ? 'sec-pass' : ''} ${className}`}
    >
      <div className="sec-col">
        {head && <div className="sec-head">{head}</div>}
        <div className="sec-window" aria-hidden />
        {children && <div className="sec-body">{children}</div>}
      </div>
    </section>
  );
}

/** Подпись секции: мелкие заглавные с линией. */
export function Label({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <p className="label" data-rv="up" style={style}>
      {children}
    </p>
  );
}

/**
 * Заголовок со словами, проявляющимися из-под маски (каждое слово — снизу вверх, по очереди).
 * Слова не рвутся: размер ограничен шириной колонки и самым длинным словом (--chars).
 */
export function Words({
  text,
  as: Tag = 'h2',
  className = 'h2',
  intro = false,
}: {
  text: string;
  as?: 'h1' | 'h2';
  className?: string;
  /** главная: проявляется вместе со вступлением, а не при прокрутке */
  intro?: boolean;
}) {
  const words = text.split(' ');
  const chars = Math.max(...words.map((w) => w.length));
  return (
    <Tag
      className={`words ${className}`}
      data-rv={intro ? undefined : 'mask'}
      aria-label={text}
      style={{ ['--chars' as string]: chars }}
    >
      {words.map((word, i) => (
        <span key={i} aria-hidden>
          {i > 0 && ' '}
          <span className="w">
            <span style={k(i)}>{word}</span>
          </span>
        </span>
      ))}
    </Tag>
  );
}
