import { liteDevice } from '../../game/skins';
import { sceneApi, useSite } from '../store';
import { beginIntro, onTick } from '../timeline';
import { SiteWorld } from './world';

/**
 * Запуск 3D-сцены (отдельный чанк: three.js грузится, пока виден экран загрузки).
 * Возвращает остановку; если WebGL 2 нет — сайт показывается без 3D.
 */
export async function startScene(canvas: HTMLCanvasElement): Promise<() => void> {
  const site = useSite.getState();
  // проверка на отдельном канвасе: на основном контекст создаст three.js со своими параметрами
  if (!document.createElement('canvas').getContext('webgl2')) {
    site.setNoWebgl();
    return () => {};
  }

  let world: SiteWorld;
  try {
    world = new SiteWorld({ canvas, lite: liteDevice(), onProgress: site.setProgress });
  } catch (e) {
    console.error(e);
    site.setNoWebgl();
    return () => {};
  }
  world.resize();
  const onResize = () => world.resize();
  window.addEventListener('resize', onResize);
  const onLost = (e: Event) => {
    e.preventDefault();
    useSite.getState().setNoWebgl();
  };
  canvas.addEventListener('webglcontextlost', onLost);

  let selected = useSite.getState().selected;
  const unsubscribe = useSite.subscribe((s) => {
    selected = s.selected;
  });
  const stop = onTick((v) => world.frame(v, selected));
  sceneApi.set({
    tap: (x, y, turbo) => world.tap(x, y, turbo),
    catRect: () => world.catRect(),
  });

  try {
    await world.load();
  } catch (e) {
    console.error(e);
  }
  useSite.getState().setReady();
  beginIntro();
  // остальные станции — в фоне, первый экран уже живёт
  void world
    .loadRest()
    .then(() => (document.documentElement.dataset.world = 'full'))
    .catch((e) => console.error(e));

  return () => {
    stop();
    unsubscribe();
    sceneApi.set(null);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('webglcontextlost', onLost);
    world.dispose();
  };
}
