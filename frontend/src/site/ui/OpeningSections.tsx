import { formatInt } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { TurboIcon } from '../../components/boostIcons';
import { BoltIcon, CoinIcon } from '../../components/icons';
import { RollingNumber } from '../../components/RollingNumber';
import { BOOSTS, GAME_FACTS, HOW_STEPS, KEY_FACTS, STORY_STEPS, sectionIndex } from '../content';
import { demoBalance, demoEnergy, demoTap, isTurbo, startTurbo, turboSeconds, useDemo } from '../demo';
import { sceneApi } from '../store';
import { flyTo, nearness, onTick } from '../timeline';
import { PlayButton } from './Chrome';
import { useAtStation } from './hooks';
import { STEP_ICONS } from './iconSets';
import { k } from './reveal';
import { Label, Section, Words } from './Section';

const PLAY = sectionIndex('play');

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

/**
 * 2. Мир и история: как из одного тапа вырос мир — коротко о проекте, ключевые цифры игры и путь проекта.
 * В сцене — Странник на краю своего мира (не тот кот, что на главной).
 */
export function WorldSection() {
  return (
    <Section
      id="world"
      layout="right"
      head={
        <>
          <Label>Our story</Label>
          <Words text="A world built one cat at a time" />
          <p className="lead" data-rv="up" style={k(2)}>
            What started as a simple tap became something much bigger. A universe of unique cats, mysterious
            worlds, rare characters and endless progression — built directly inside Telegram. Every character
            has its own identity. Every world has its own story.
          </p>
          <p className="motto" data-rv="up" style={k(3)}>
            Collect. Upgrade. Discover.
          </p>
        </>
      }
    >
      <dl className="facts">
        {KEY_FACTS.map((f, i) => (
          <div key={f.label} className="fact" data-rv="rise" style={k(i)}>
            <dt>
              <span className="fact-value">{f.value}</span>
              <span className="tag">{f.label}</span>
            </dt>
            <dd className="small">{f.text}</dd>
          </div>
        ))}
      </dl>
      <ol className="milestones" data-rv="up" style={k(4)} aria-label="The journey so far">
        {STORY_STEPS.map((step, i) => (
          <li key={step.title}>
            <span className="milestone-num">{String(i + 1).padStart(2, '0')}</span>
            <div className="min-w-0">
              <p className="h4">{step.title}</p>
              <p className="small">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * 3. Как играть: четыре механики с цифрами игры, бусты и живое демо. В сцене — инженер Токсик среди
 * карточек-активов: его можно тапать (искры у пальца и +1 к балансу; сам кот не реагирует).
 */
export function PlaySection() {
  return (
    <>
      <TapLayer />
      <Section
        id="play"
        layout="left"
        pass
        head={
          <>
            <Label>Gameplay</Label>
            <Words text="How it works" />
            <p className="lead" data-rv="up" style={k(2)}>
              Short sessions, lasting progress. Tap to earn, put your PAW into assets that keep earning,
              collect characters and climb the leagues.
            </p>
          </>
        }
      >
        <div className="steps">
          {HOW_STEPS.map((step, i) => (
            <article key={step.title} className="card step pe" data-rv="rise" style={k(i)}>
              <div className="step-top">
                <span className="step-icon">{STEP_ICONS[step.title]}</span>
                <h3 className="h3">{step.title}</h3>
              </div>
              <p className="small">{step.text}</p>
              <p className="step-detail">{step.detail}</p>
            </article>
          ))}
        </div>
        <DemoStrip />
      </Section>
      <TapHint />
    </>
  );
}

/** Демо игры: баланс, энергия и Turbo — меняются от тапов по Токсику. */
function DemoStrip() {
  const turboLeft = useDemo((s) => s.turboLeft);
  const turboOn = useDemo((s) => s.turboActive);
  const fillRef = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const turboRef = useRef<HTMLSpanElement>(null);
  useEffect(
    () =>
      onTick((v) => {
        // вдали от станции DOM не трогаем
        if (Math.abs(v.pos - PLAY) > 0.8) return;
        const e = demoEnergy();
        const turbo = isTurbo();
        if (fillRef.current)
          fillRef.current.style.transform = `scaleX(${(turbo ? 1 : e / GAME_FACTS.energy.max).toFixed(4)})`;
        const text = turbo
          ? 'Turbo · no energy'
          : `${formatInt(Math.floor(e))} / ${formatInt(GAME_FACTS.energy.max)}`;
        if (textRef.current && textRef.current.textContent !== text) textRef.current.textContent = text;
        const sec = Math.ceil(turboSeconds());
        const label = sec > 0 ? `0:${String(sec).padStart(2, '0')}` : `Turbo ×${GAME_FACTS.turbo.multiplier}`;
        if (turboRef.current && turboRef.current.textContent !== label) turboRef.current.textContent = label;
      }),
    [],
  );
  return (
    <div className="demo glass pe" data-rv="up" style={k(4)} aria-label="Game demo">
      <div className="demo-row">
        <div className="demo-balance">
          <CoinIcon size={24} />
          <RollingNumber getValue={demoBalance} glowOnJump={false} />
        </div>
        <button
          type="button"
          className="turbo"
          data-active={turboOn}
          disabled={turboLeft <= 0 && !turboOn}
          onClick={() => startTurbo()}
          aria-label={`Turbo, ${turboLeft} of ${GAME_FACTS.turbo.perDay} left today`}
        >
          <TurboIcon size={22} />
          <span ref={turboRef} />
        </button>
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
      <ul className="boosts">
        {BOOSTS.map((b) => (
          <li key={b.title}>
            <b>{b.title}</b> {b.text}
          </li>
        ))}
      </ul>
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
