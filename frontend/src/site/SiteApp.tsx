import { useEffect, useRef, useState } from 'react';
import { CATS, HERO_CAT, catAsset } from './cats';
import { STATIONS } from './content';
import { useSite } from './store';
import { startTimeline, view } from './timeline';
import { Loader, Nav, Rail } from './ui/Chrome';
import { CollectionSection } from './ui/CollectionSection';
import { GameSection } from './ui/GameSection';
import { HomeSection } from './ui/HomeSection';
import { AirdropSection, EarnSection, UpgradesSection } from './ui/InfoSections';

/** Вступление интерфейса после проявления сцены (секунды от старта вступления). */
const UI_INTRO_AT = 2.2;

export function SiteApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const ready = useSite((s) => s.ready);
  const noWebgl = useSite((s) => s.noWebgl);
  const [introOn, setIntroOn] = useState(false);

  // прокрутка → таймлайн; браузер не восстанавливает прокрутку: сайт всегда начинается с вступления
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    return startTimeline(spacerRef.current!);
  }, []);

  // 3D-сцена — отдельный чанк (three.js)
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    void import('./scene').then(async ({ startScene }) => {
      if (cancelled || !canvasRef.current) return;
      const dispose = await startScene(canvasRef.current);
      if (cancelled) dispose();
      else stop = dispose;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // интерфейс проявляется, когда кот уже собрался из искр; прокрутка — после вступления
  useEffect(() => {
    if (!ready) return;
    const delay = view.reduced || noWebgl ? 0 : UI_INTRO_AT * 1000;
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      setIntroOn(true);
      root.style.overflow = '';
    }, delay);
    return () => {
      window.clearTimeout(timer);
      root.style.overflow = '';
    };
  }, [ready, noWebgl]);

  return (
    <div data-intro={introOn ? 'on' : 'off'}>
      {noWebgl ? <StaticStage /> : <canvas ref={canvasRef} className="stage" aria-hidden />}
      <div className="stage-veil" />
      <Nav />
      <Rail />
      <HomeSection />
      <GameSection />
      <CollectionSection />
      <UpgradesSection />
      <EarnSection />
      <AirdropSection />
      <div ref={spacerRef} className="spacer">
        {STATIONS.map((id, i) => (
          <span key={id} className="snap" style={{ top: `calc(var(--step) * ${i})` }} />
        ))}
      </div>
      <Loader />
    </div>
  );
}

/** Без WebGL: мир и кот картинками (без 3D-движения), интерфейс тот же. */
function StaticStage() {
  const cat = HERO_CAT;
  return (
    <div className="stage overflow-hidden" aria-hidden>
      <img
        src={catAsset(cat.id, 'background', 1800, 'webp')}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <img
        src={catAsset(cat.id, 'character', 1200, 'webp')}
        alt=""
        className="absolute bottom-[6%] left-1/2 h-[70%] w-auto -translate-x-1/2"
      />
      <span className="sr-only">{CATS.map((c) => c.name).join(', ')}</span>
    </div>
  );
}
