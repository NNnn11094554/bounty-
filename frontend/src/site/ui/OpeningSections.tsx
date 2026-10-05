import { formatInt } from '@meowgul/shared';
import { useEffect, useRef } from 'react';
import { TurboIcon } from '../../components/boostIcons';
import { BoltIcon, CoinIcon } from '../../components/icons';
import { RollingNumber } from '../../components/RollingNumber';
import { GAME_FACTS, LOOP, sectionIndex } from '../content';
import { demoBalance, demoEnergy, demoTap, isTurbo, startTurbo, turboSeconds, useDemo } from '../demo';
import { fmt, useT } from '../i18n';
import { sceneApi } from '../store';
import { flyTo, nearness, onTick } from '../timeline';
import { PlayButton } from './Chrome';
import { useAtStation } from './hooks';
import { LOOP_ICONS } from './iconSets';
import { k } from './reveal';
import { Label, Section, Words } from './Section';
import { setStyle } from './style';

const PLAY = sectionIndex('gameplay');

/**
 * 1. Главная: заголовок проявляется сразу (не ждёт 3D), кот — справа (на телефоне — между заголовком и
 * кнопками). «Играть» — в Mini App, «О проекте» — к рассказу о проекте.
 */
export function HeroSection() {
  const t = useT();
  const learn = (
    <button type="button" className="btn btn-ghost" onClick={() => flyTo(sectionIndex('project'))}>
      {t.cta.learn}
    </button>
  );
  return (
    <section id="home" data-station={0} className="sec hero">
      <div className="hero-text">
        <p className="label intro-fade" style={k(0)}>
          {t.hero.label}
        </p>
        <Words as="h1" className="hero-title" text={t.hero.title} intro />
        <p className="lead intro-fade hero-lead" style={k(1)}>
          {t.hero.lead}
        </p>
        <div className="actions intro-fade hero-actions-wide" style={k(2)}>
          <PlayButton className="btn-lg" />
          {learn}
        </div>
      </div>
      <div className="hero-bottom">
        <div className="actions intro-fade" style={k(2)}>
          <PlayButton className="btn-lg flex-1" />
          {learn}
        </div>
      </div>
      <div className="scroll-hint intro-fade" style={k(4)} aria-hidden>
        {t.hero.scroll}
        <i />
      </div>
    </section>
  );
}

/**
 * 2. Проект: что это, зачем, что получает игрок, куда движется — четыре коротких блока и цифры игры.
 * В сцене — Странник на краю своего мира.
 */
export function ProjectSection() {
  const t = useT();
  return (
    <Section
      id="project"
      layout="right"
      head={
        <>
          <Label>{t.project.label}</Label>
          <Words text={t.project.title} />
        </>
      }
    >
      <div className="story">
        {t.project.blocks.map((b, i) => (
          <article key={i} className="story-block" data-rv="up" style={k(i + 1)}>
            <span className="story-num">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="h3">{b.title}</h3>
            <p className="small">{b.text}</p>
          </article>
        ))}
      </div>
      <dl className="stats" data-rv="up" style={k(5)}>
        {t.project.facts.map((f, i) => (
          <div key={i}>
            <dt className="stat-value">{f.value}</dt>
            <dd className="tag">{f.label}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/**
 * 3. Как это работает: игровой цикл из пяти шагов (с цифрами игры) и живое демо. В сцене — инженер Токсик
 * среди карточек-активов: его можно тапать (искры у пальца и +1 к балансу; сам кот не реагирует).
 */
export function GameplaySection() {
  const t = useT();
  return (
    <>
      <TapLayer />
      <Section
        id="gameplay"
        layout="left"
        className="sec-wide"
        pass
        head={
          <>
            <Label>{t.gameplay.label}</Label>
            <Words text={t.gameplay.title} />
            <p className="lead" data-rv="up" style={k(2)}>
              {t.gameplay.lead}
            </p>
          </>
        }
      >
        <div className="split">
          <ol className="loop">
            {t.gameplay.loop.map((step, i) => (
              <li key={i} className="loop-step pe" data-rv="rise" style={k(i)}>
                <span className="loop-icon">{LOOP_ICONS[LOOP[i]!]}</span>
                <div className="min-w-0">
                  <h3 className="h3">
                    <span className="loop-num">{String(i + 1).padStart(2, '0')}</span>
                    {step.title}
                  </h3>
                  <p className="small">{step.text}</p>
                  <p className="detail">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <DemoStrip />
        </div>
      </Section>
      <TapHint />
    </>
  );
}

/** Демо игры: баланс, энергия и Turbo — меняются от тапов по Токсику. */
function DemoStrip() {
  const t = useT();
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
          setStyle(
            fillRef.current,
            'transform',
            `scaleX(${(turbo ? 1 : e / GAME_FACTS.energy.max).toFixed(4)})`,
          );
        const text = turbo
          ? t.gameplay.turboOn
          : `${formatInt(Math.floor(e))} / ${formatInt(GAME_FACTS.energy.max)}`;
        if (textRef.current && textRef.current.textContent !== text) textRef.current.textContent = text;
        const sec = Math.ceil(turboSeconds());
        const label =
          sec > 0
            ? `0:${String(sec).padStart(2, '0')}`
            : fmt(t.gameplay.turbo, { x: GAME_FACTS.turbo.multiplier });
        if (turboRef.current && turboRef.current.textContent !== label) turboRef.current.textContent = label;
      }),
    [t],
  );
  return (
    <div className="demo glass pe" data-rv="up" style={k(5)} aria-label={t.gameplay.demo}>
      <p className="tag demo-title">{t.gameplay.demo}</p>
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
          aria-label={fmt(t.gameplay.turboAria, { left: turboLeft, total: GAME_FACTS.turbo.perDay })}
        >
          <TurboIcon size={22} />
          <span ref={turboRef} />
        </button>
      </div>
      <div className="demo-energy">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[color:var(--gold)]">
            <BoltIcon size={15} />
            <span className="tag">{t.gameplay.energy}</span>
          </span>
          <span className="small tabular" ref={textRef} />
        </div>
        <div className="bar" style={{ ['--from' as string]: '#ffc93c', ['--to' as string]: '#ff8a3d' }}>
          <i ref={fillRef} />
        </div>
      </div>
      <ul className="boosts">
        {t.gameplay.boosts.map((b) => (
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
  const t = useT();
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
    el.textContent = value === null ? t.gameplay.noEnergy : `+${value}`;
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
  const t = useT();
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
        setStyle(el, 'opacity', '0');
        setStyle(el, 'visibility', 'hidden');
        return;
      }
      // вдали подсказка скрыта (visibility) — её пульсация тогда и не анимируется
      setStyle(el, 'visibility', 'visible');
      setStyle(el, 'opacity', String(Math.max(0, near * 1.6 - 0.6).toFixed(3)));
      setStyle(
        el,
        'transform',
        `translate3d(${(rect.x + rect.width / 2).toFixed(1)}px, ${(rect.y + rect.height * 0.45).toFixed(1)}px, 0) translateX(-50%)`,
      );
    });
  }, [taps]);
  if (taps > 0) return null;
  return (
    <div ref={ref} className="tap-hint" style={{ opacity: 0, visibility: 'hidden' }}>
      {t.gameplay.tapHint}
    </div>
  );
}
