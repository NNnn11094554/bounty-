import { formatInt, formatShort, isTutorialId, type TutorialId } from '@meowgul/shared';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { endpoints } from '../api/endpoints';
import { onFrame } from '../game/frameLoop';
import { TUTORIAL_STEPS } from '../game/tutorials';
import { useBackHandler } from '../hooks/useBackHandler';
import { useLocale, useT } from '../i18n';
import { useGame } from '../store/game';
import { useBlockingOverlay, useOverlays } from '../store/overlays';
import { haptic } from '../telegram/webapp';
import { Button } from './Button';

const PAD = 8;
const BUBBLE_H = 176;
const START_DELAY_MS = 700;
/** показанные за сессию: состояние с сервера может прийти раньше, чем он запомнит просмотр */
const doneIds = new Set<string>();

/** В e2e-сборке подсказки не мешают сценариям; проверить их можно параметром ?tutorials=1. */
function skipTutorials(): boolean {
  if (import.meta.env.MODE !== 'e2e' || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('tutorials') !== '1';
}

function findTarget(name: string): HTMLElement | null {
  // скрытые вкладки тоже в документе (components/TabLayer) — элемент ищется только на видимом экране
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`))) {
    if (el.closest('.tab-layer[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Подсказки при первом открытии вкладки: затемнение с «окном» вокруг элемента, стрелка и текст.
 * Ждут, пока закроются онбординг, модалки и сцены; просмотр запоминается на сервере.
 */
export function TabTutorial({ screen }: { screen: string }) {
  const t = useT();
  const locale = useLocale();
  const seen = useGame((s) => s.player?.profile.tutorialsSeen);
  const config = useGame((s) => s.config);
  const blocking = useOverlays((s) => s.blocking > 0);
  const [active, setActive] = useState<TutorialId | null>(null);
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);

  // запуск: вкладка открыта впервые, ничего не перекрывает экран, первый элемент уже на месте
  useEffect(() => {
    if (active || blocking || !seen || !isTutorialId(screen) || skipTutorials()) return;
    if (seen.includes(screen) || doneIds.has(screen)) return;
    let tries = 0;
    let timer = window.setTimeout(function attempt() {
      const first = TUTORIAL_STEPS[screen].find((s) => findTarget(s.target));
      if (first) {
        setStep(0);
        setActive(screen);
      } else if (++tries < 10) {
        timer = window.setTimeout(attempt, 300);
      }
    }, START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [screen, seen, blocking, active]);

  const steps = active ? TUTORIAL_STEPS[active] : [];
  const current = steps[step];

  const finish = () => {
    if (!active) return;
    doneIds.add(active);
    void endpoints.tutorialSeen(active).catch(() => undefined);
    setActive(null);
    setBox(null);
  };
  useBackHandler(active !== null, finish);
  useBlockingOverlay(active !== null);

  const next = () => {
    haptic.select();
    // следующий шаг, элемент которого есть на экране
    for (let i = step + 1; i < steps.length; i++) {
      if (findTarget(steps[i]!.target)) {
        setStep(i);
        return;
      }
    }
    finish();
  };

  // элемент шага: прокрутить в видимую область и следить за его положением
  useEffect(() => {
    if (!current) return;
    const el = findTarget(current.target);
    targetRef.current = el;
    if (!el) {
      next();
      return;
    }
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    let last = '';
    // рамка следует за элементом при плавной прокрутке — каждый кадр
    return onFrame(
      () => {
        const r = targetRef.current?.getBoundingClientRect();
        if (!r) return;
        const key = `${Math.round(r.left)}:${Math.round(r.top)}:${Math.round(r.width)}:${Math.round(r.height)}`;
        if (key === last) return;
        last = key;
        setBox({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2 });
      },
      { hot: true },
    );
    // next зависит от шага — перезапуск нужен только при смене шага
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!active || !current) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bubbleW = Math.min(340, vw - 32);
  let bubbleTop = 0;
  let arrow: 'up' | 'down' | null = null;
  if (box) {
    const below = vh - (box.y + box.h);
    if (below >= BUBBLE_H + 16) {
      bubbleTop = box.y + box.h + 14;
      arrow = 'up';
    } else if (box.y >= BUBBLE_H + 16) {
      bubbleTop = box.y - BUBBLE_H - 14;
      arrow = 'down';
    } else {
      // элемент почти во весь экран — подсказка поверх его нижней части
      bubbleTop = Math.min(vh - BUBBLE_H - 24, box.y + box.h - BUBBLE_H - 16);
    }
  }
  const centerX = box ? box.x + box.w / 2 : vw / 2;
  const bubbleLeft = Math.min(Math.max(16, centerX - bubbleW / 2), vw - 16 - bubbleW);
  const arrowX = Math.min(Math.max(24, centerX - bubbleLeft), bubbleW - 24);

  const vars = {
    hours: config?.passive.maxOfflineHours ?? 3,
    regular: formatInt(config?.referral.regular ?? 0),
    premium: formatInt(config?.referral.premium ?? 0),
    max: formatShort(Math.max(0, ...(config?.dailyRewards ?? [0])), locale),
    x: config?.turbo.multiplier ?? 5,
  };

  return createPortal(
    <div className="fixed inset-0 z-[57]" onClick={next} data-testid="tutorial" data-tutorial={active}>
      <AnimatePresence>
        {box && (
          <motion.div
            className="pointer-events-none absolute rounded-[22px] ring-2 ring-gold/80"
            style={{ boxShadow: '0 0 0 9999px rgba(8,5,18,0.8), 0 0 28px rgba(255,201,60,0.45)' }}
            initial={{ opacity: 0, left: box.x, top: box.y, width: box.w, height: box.h }}
            animate={{ opacity: 1, left: box.x, top: box.y, width: box.w, height: box.h }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          />
        )}
      </AnimatePresence>
      {box && (
        <motion.div
          key={step}
          role="dialog"
          aria-live="polite"
          initial={{ opacity: 0, y: arrow === 'down' ? -10 : 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className="absolute rounded-[22px] border border-gold/40 bg-night-700 p-4 shadow-glow"
          style={{ left: bubbleLeft, top: bubbleTop, width: bubbleW, minHeight: BUBBLE_H - 24 }}
          onClick={(e) => e.stopPropagation()}
          data-testid="tutorial-bubble"
        >
          {arrow && (
            <span
              aria-hidden
              className={`absolute h-4 w-4 rotate-45 border-gold/40 bg-night-700 ${
                arrow === 'up' ? '-top-2 border-l border-t' : '-bottom-2 border-b border-r'
              }`}
              style={{ left: arrowX - 8 }}
            />
          )}
          <p className="text-[15px] font-bold leading-snug" data-testid="tutorial-text">
            {t(current.text, vars)}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="flex-1 text-xs font-extrabold text-white/45">
              {t('tour.step', { n: step + 1, total: steps.length })}
            </span>
            {step < steps.length - 1 && (
              <button
                type="button"
                onClick={finish}
                className="px-2 py-2 text-sm font-extrabold text-white/55"
                data-testid="tutorial-skip"
              >
                {t('tour.skip')}
              </button>
            )}
            <Button className="h-10 px-4 text-sm" onClick={next} data-testid="tutorial-next">
              {step < steps.length - 1 ? t('tour.next') : t('tour.done')}
            </Button>
          </div>
        </motion.div>
      )}
    </div>,
    document.body,
  );
}
