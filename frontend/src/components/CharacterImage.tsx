import type { CSSProperties } from 'react';
import { characterUrl } from '../lib/character';

interface Props {
  /** размер на экране, px — по нему выбирается файл нужной плотности */
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** своя картинка (скин с отдельным артом); по умолчанию — персонаж игры */
  src?: string;
}

/**
 * Персонаж — готовая картинка без изменений. Рисуется фоном блока, а не тегом <img>: долгое нажатие
 * на <img> в WebView Telegram открывает системное меню картинки («Открыть», «Сохранить», «Поделиться
 * ссылкой») — для тапалки это выглядит как переход по внешней ссылке. У фона такого меню нет.
 */
export function CharacterImage({ size, className, style, src }: Props) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none select-none ${className ?? ''}`}
      style={{
        backgroundImage: `url(${src ?? characterUrl(size)})`,
        backgroundSize: 'cover',
        backgroundPosition: '50% 50%',
        backgroundRepeat: 'no-repeat',
        ...(size ? { width: size, height: size } : {}),
        ...style,
      }}
    />
  );
}
