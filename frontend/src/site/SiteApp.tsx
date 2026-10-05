import { useCallback, useEffect, useRef, useState } from 'react';
import { CATS, HERO_CAT, catAsset } from './cats';
import { applyDocumentLocale, useLang, useT } from './i18n';
import { useSite } from './store';
import { startTimeline, view } from './timeline';
import { CollectionSection } from './ui/CatSections';
import { Nav } from './ui/Chrome';
import { CommunitySection, Footer, PartnersSection, RoadmapSection } from './ui/EndSections';
import { GameplaySection, HeroSection, ProjectSection } from './ui/OpeningSections';
import { AirdropSection, ProgressSection } from './ui/ProgressSections';
import { useReveal } from './ui/reveal';

/**
 * Интерфейс главной проявляется сразу, как готовы шрифты (не ждёт 3D): мс после этого. Сцена проявляется
 * сама, когда загружены главный кот и его мир.
 */
const UI_INTRO_DELAY = 250;

export function SiteApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const ready = useSite((s) => s.ready);
  const noWebgl = useSite((s) => s.noWebgl);
  const locale = useLang((s) => s.locale);
  const dict = useLang((s) => s.dict);

  // язык документа: lang (шрифты и переносы), заголовок вкладки и описание
  useEffect(() => applyDocumentLocale(locale, dict), [locale, dict]);
  const [introOn, setIntroOn] = useState(false);

  // прокрутка → таймлайн; браузер не восстанавливает прокрутку: сайт всегда начинается с вступления
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    return startTimeline(pageRef.current!);
  }, []);
  useReveal(useCallback(() => pageRef.current, []));

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

  // интерфейс — как только готовы шрифты (заголовок не перестраивается на глазах); 3D догоняет
  useEffect(() => {
    let timer = 0;
    const show = () => {
      timer = window.setTimeout(() => setIntroOn(true), view.reduced ? 0 : UI_INTRO_DELAY);
    };
    // шрифты обычно готовы за доли секунды; если сеть медленная — не дольше 1.2 с
    void Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 1200))]).then(show);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div data-intro={introOn ? 'on' : 'off'} data-scene={ready || noWebgl ? 'ready' : 'loading'}>
      {noWebgl ? <StaticStage /> : <canvas ref={canvasRef} className="stage" aria-hidden />}
      <div className="stage-warm" aria-hidden />
      <div className="stage-veil" />
      <Nav />
      <main ref={pageRef} className="page">
        <HeroSection />
        <ProjectSection />
        <GameplaySection />
        <CollectionSection />
        <ProgressSection />
        <AirdropSection />
        <PartnersSection />
        <RoadmapSection />
        <CommunitySection />
      </main>
      <Footer />
    </div>
  );
}

/** Без WebGL: мир и кот картинками (без 3D-движения), интерфейс тот же. */
function StaticStage() {
  const t = useT();
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
      <span className="sr-only">{CATS.map((c) => t.cats[c.id as keyof typeof t.cats].name).join(', ')}</span>
    </div>
  );
}
