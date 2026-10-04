import { formatInt } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { BoltIcon, CoinIcon } from '../../components/icons';
import { RollingNumber } from '../../components/RollingNumber';
import { GAME_FACTS, HOW_STEPS, STORY_STEPS, sectionIndex } from '../content';
import { demoBalance, demoEnergy, demoTap, isTurbo, useDemo } from '../demo';
import { sceneApi } from '../store';
import { flyTo, nearness, onTick } from '../timeline';
import { PlayButton } from './Chrome';
import { useAtStation } from './hooks';
import { STEP_ICONS } from './iconSets';
import { k } from './reveal';
import { Label, Section, Words } from './Section';

const PLAY = sectionIndex('how');

/** 1. Главная: заголовок проявляется вместе со сценой, кот — справа (на телефоне — под заголовком). */
export function HeroSection() {
  return (
    <section id="home" data-station={0} className="sec hero">
      <div className="hero-text">
        <p className="label intro-fade" style={k(0)}>
          Telegram Mini App
        </p>
        <Words as="h1" className="hero-title" text="Enter the world of Meowgul" intro />
        <p className="lead intro-fade hero-lead" style={k(1)}>
          A living Telegram game where every tap, every upgrade and every discovery takes you deeper into a
          growing universe.
        </p>
        <div className="actions intro-fade hero-actions-wide" style={k(2)}>
          <PlayButton />
          <button type="button" className="btn btn-ghost" onClick={() => flyTo(sectionIndex('world'))}>
            Explore the world
          </button>
        </div>
      </div>
      <div className="hero-bottom">
        <div className="actions intro-fade" style={k(2)}>
          <PlayButton className="flex-1" />
          <button type="button" className="btn btn-ghost" onClick={() => flyTo(sectionIndex('world'))}>
            Explore the world
          </button>
        </div>
      </div>
      <div className="scroll-hint intro-fade" style={k(4)} aria-hidden>
        Scroll
        <i />
      </div>
    </section>
  );
}

/** 2. История: как из одного тапа вырос мир. Таймлайн рисуется линией сверху вниз. */
export function StorySection() {
  return (
    <Section
      id="story"
      layout="right"
      head={
        <>
          <Label>Our story</Label>
          <Words text="A world built one cat at a time" />
        </>
      }
    >
      <p className="lead" data-rv="up" style={k(1)}>
        What started as a simple tap became something much bigger. A universe of unique cats, mysterious
        worlds, rare characters and endless progression — built directly inside Telegram.
      </p>
      <p className="motto" data-rv="up" style={k(2)}>
        Collect. Upgrade. Discover.
      </p>
      <p className="lead" data-rv="up" style={k(3)}>
        Every character has its own identity. Every world has its own story. And the journey is only
        beginning.
      </p>
      <ol className="timeline" data-rv="line">
        {STORY_STEPS.map((step, i) => (
          <li key={step.title} data-rv="up" style={k(4 + i)}>
            <span className="timeline-num">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <p className="h4">{step.title}</p>
              <p className="small">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** 3. Как играть: четыре шага по очереди; кот над ними — его можно тапать (демо игры). */
export function HowSection() {
  return (
    <>
      <TapLayer />
      <Section
        id="how"
        layout="center"
        pass
        head={
          <>
            <Label>Gameplay</Label>
            <Words text="How it works" />
          </>
        }
      >
        <DemoStrip />
        <div className="steps">
          {HOW_STEPS.map((step, i) => (
            <article key={step.title} className="card step pe" data-rv="rise" style={k(i)}>
              <span className="step-icon">{STEP_ICONS[step.title]}</span>
              <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="h3">{step.title}</h3>
              <p className="small">{step.text}</p>
            </article>
          ))}
        </div>
      </Section>
      <TapHint />
    </>
  );
}

/** Демо игры над шагами: баланс и энергия, которые меняются от тапов по коту. */
function DemoStrip() {
  const fillRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      onTick((v) => {
        // вдали от станции DOM не трогаем
        if (Math.abs(v.pos - PLAY) > 0.8) return;
        const e = demoEnergy();
        const turbo = isTurbo();
        if (fillRef.current)
          fillRef.current.style.transform = `scaleX(${(turbo ? 1 : e / GAME_FACTS.energy.max).toFixed(4)})`;
        const text = `${formatInt(Math.floor(e))} / ${formatInt(GAME_FACTS.energy.max)}`;
        if (textRef.current && textRef.current.textContent !== text) textRef.current.textContent = text;
      }),
    [],
  );
  return (
    <div className="demo glass pe" data-rv="up" aria-label="Game demo">
      <div className="demo-balance">
        <CoinIcon size={26} />
        <RollingNumber getValue={demoBalance} glowOnJump={false} />
      </div>
      <div className="demo-energy">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[color:var(--gold)]">
            <BoltIcon size={15} />
            <span className="tag">Energy</span>
          </span>
          <span className="small tabular" ref={textRef} />
        </div>
        <div className="bar" style={{ ['--from' as string]: '#ffc93c', ['--to' as string]: '#ff8a3d' }}>
          <i ref={fillRef} />
        </div>
      </div>
    </div>
  );
}

const MAX_FLOATS = 28;

/**
 * Слой тапов: ловит касания у станции «как играть» и спрашивает сцену, попал ли палец в кота.
 * Кот на тап не реагирует — только искры у пальца и +1 к балансу (игровая механика).
 * Мышь — сразу по нажатию; касание — по отпусканию без сдвига (свайп листает страницу, а не тапает).
 */
function TapLayer() {
  const active = useAtStation(PLAY);
  const touches = useRef(new Map<number, { x: number; y: number; t: number }>());
  const floats = useRef(0);

  const reward = (x: number, y: number) => {
    const api = sceneApi.get();
    const turbo = isTurbo();
    if (!api?.tap(x, y, turbo)) return;
    const value = demoTap();
    if (floats.current >= MAX_FLOATS) return;
    const el = document.createElement('div');
    el.className = 'float-reward';
    el.dataset.turbo = String(turbo);
    el.textContent = value === null ? 'No energy' : `+${value}`;
    if (value === null) el.style.fontSize = '16px';
    document.body.appendChild(el);
    floats.current++;
    const dx = (Math.random() - 0.5) * 40;
    const anim = el.animate(
      [
        { transform: `translate(${x - 20}px, ${y - 24}px) scale(0.6)`, opacity: 0 },
        { transform: `translate(${x - 20 + dx * 0.3}px, ${y - 54}px) scale(1.08)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${x - 20 + dx}px, ${y - 150}px) scale(0.92)`, opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
    anim.onfinish = () => {
      el.remove();
      floats.current--;
    };
  };

  return (
    <div
      className="tap-layer"
      style={{ display: active ? 'block' : 'none' }}
      aria-hidden
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') {
          if (e.button === 0) reward(e.clientX, e.clientY);
          return;
        }
        touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
      }}
      onPointerUp={(e) => {
        const start = touches.current.get(e.pointerId);
        touches.current.delete(e.pointerId);
        if (!start) return;
        const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (moved < 12 && performance.now() - start.t < 450) reward(e.clientX, e.clientY);
      }}
      onPointerCancel={(e) => touches.current.delete(e.pointerId)}
    />
  );
}

/** «Tap the cat» на коте, пока не было ни одного тапа. */
function TapHint() {
  const taps = useDemo((s) => s.taps);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (taps > 0) return;
    return onTick((v) => {
      const el = ref.current;
      if (!el) return;
      const near = nearness(v.pos, PLAY);
      const rect = near > 0.05 ? sceneApi.get()?.catRect() : null;
      if (!rect) {
        el.style.opacity = '0';
        return;
      }
      el.style.opacity = String(Math.max(0, near * 1.6 - 0.6));
      el.style.transform = `translate3d(${rect.x + rect.width / 2}px, ${rect.y + rect.height * 0.45}px, 0) translateX(-50%)`;
    });
  }, [taps]);
  if (taps > 0) return null;
  return (
    <div ref={ref} className="tap-hint" style={{ opacity: 0 }}>
      Tap the cat
    </div>
  );
}
