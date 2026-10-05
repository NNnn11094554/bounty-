import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { CardIcon } from '../../components/cards/CardIcon';

/** Иконка актива из игры (та же монета токена) как SVG-разметка — для текстуры в сцене. */
export function tokenSvg(icon: string, size: number): string {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => root.render(<CardIcon icon={icon} size={size} />));
  const svg = host.querySelector('svg');
  let markup = '';
  if (svg) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // в картинке нет шрифтов страницы: тикер — системным жирным
    svg.setAttribute('font-family', 'Arial Black, Arial, Helvetica, sans-serif');
    markup = svg.outerHTML.replaceAll('font-family="inherit"', '');
  }
  root.unmount();
  return markup;
}
