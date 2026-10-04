import {
  Suspense,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { DURATION, EASING } from '../animations';
import { createLayer, LayerContext, setLayerVisible } from '../hooks/tabLayer';
import type { Tab } from '../store/nav';

const HIDE_TEST_IDS = import.meta.env.MODE === 'e2e';

/** Сигнал «содержимое вкладки построено» (стоит рядом с экраном — вместе с ним и появляется). */
function Ready({ onReady }: { onReady: () => void }) {
  useLayoutEffect(onReady, [onReady]);
  return null;
}

interface Props {
  tab: Tab;
  /** вкладка на экране */
  visible: boolean;
  /** содержимое уже построено: скрытая готовая вкладка заморожена (до готовности — строится невидимой) */
  ready: boolean;
  /**
   * вкладку целиком закрывает экран поверх («Активы», Earn, бусты…): она заморожена так же, как скрытая, но
   * остаётся открытой вкладкой — данные не перезагружаются и «уход с экрана» не срабатывает
   */
  covered?: boolean;
  /** проявиться при показе (не при первом показе игры и не при упрощённых анимациях) */
  fade: boolean;
  onReady: (tab: Tab) => void;
  children: ReactNode;
}

/**
 * Слой вкладки. Вкладки не строятся заново при каждом переключении: открытая однажды вкладка остаётся в
 * памяти, а скрытая заморожена — сторы её не перерисовывают (store/create), браузер её не считает, не рисует и
 * не анимирует (content-visibility: hidden), но хранит готовую раскладку. Показ — без перестройки экрана и
 * без пересчёта стилей: перерисовывается только то, что изменилось, пока вкладка была скрыта. Свежие данные
 * экран подгружает сам при каждом показе (hooks/tabLayer: useOnTabShow).
 */
export function TabLayer({ tab, visible, ready, covered = false, fade, onReady, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const layer = useMemo(() => createLayer(tab), [tab]);
  const signalReady = useMemo(() => () => onReady(tab), [onReady, tab]);
  const fadeRef = useRef(fade);
  fadeRef.current = fade;

  // показ и скрытие — до отрисовки кадра: изменившееся за время скрытия перерисовывается в этом же кадре
  const live = visible && !covered;
  useLayoutEffect(() => {
    setLayerVisible(layer, live);
  }, [layer, live]);

  // показ: только прозрачность, анимация браузера на видеокарте (не зависит от загрузки JS); только в момент
  // показа (не при перерисовке); при быстром переключении прерывается — не доигрывает поверх другой вкладки
  useLayoutEffect(() => {
    const el = ref.current;
    if (!visible || !fadeRef.current || !el || typeof el.animate !== 'function') return;
    const anim = el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: DURATION.tabFade,
      easing: EASING.out,
    });
    return () => anim.cancel();
  }, [visible]);

  // e2e: элементы скрытой вкладки не находятся по data-testid — тест, как и игрок, видит только открытый экран
  // (иначе карточки магазина и коллекции нашлись бы дважды). До эффектов раскладки экрана — в фазе вставки.
  useInsertionEffect(() => {
    const el = ref.current;
    if (!HIDE_TEST_IDS || !el) return;
    if (visible) {
      el.querySelectorAll('[data-testid-hidden]').forEach((n) => {
        if (!n.hasAttribute('data-testid'))
          n.setAttribute('data-testid', n.getAttribute('data-testid-hidden')!);
        n.removeAttribute('data-testid-hidden');
      });
    } else {
      el.querySelectorAll('[data-testid]').forEach((n) => {
        n.setAttribute('data-testid-hidden', n.getAttribute('data-testid')!);
        n.removeAttribute('data-testid');
      });
    }
  }, [visible, ready]);

  // данные экрана и «уход с экрана» — после первого кадра, чтобы запросы не задерживали показ
  useEffect(() => {
    const was = layer.effectsVisible;
    layer.effectsVisible = visible;
    if (visible && !was) layer.showListeners.forEach((run) => run());
    else if (!visible && was) layer.hideListeners.forEach((run) => run());
  }, [visible, layer]);

  return (
    <div
      ref={ref}
      className="tab-layer absolute inset-0"
      data-tab={visible ? tab : undefined}
      data-tab-layer={tab}
      data-frozen={(!visible && ready) || covered ? '' : undefined}
      aria-hidden={visible ? undefined : true}
    >
      <LayerContext.Provider value={layer}>
        <Suspense fallback={null}>
          {children}
          <Ready onReady={signalReady} />
        </Suspense>
      </LayerContext.Provider>
    </div>
  );
}
