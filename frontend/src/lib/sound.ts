/**
 * Короткие звуки, синтезированные Web Audio (без файлов): тап, покупка, награда, новая лига.
 * Контекст создаётся при первом жесте пользователя (требование браузеров).
 */
export type SoundName = 'tap' | 'purchase' | 'reward' | 'coin' | 'league' | 'error' | 'click';

let ctx: AudioContext | null = null;
let enabled = true;
let lastTapAt = 0;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  slideTo?: number,
) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export function playSound(name: SoundName): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  switch (name) {
    case 'tap': {
      // не чаще 25 раз в секунду, лёгкая случайность высоты — звучит живее
      const now = performance.now();
      if (now - lastTapAt < 40) return;
      lastTapAt = now;
      tone(ac, 520 + Math.random() * 80, t, 0.06, 'triangle', 0.05, 340);
      break;
    }
    case 'click':
      tone(ac, 700, t, 0.04, 'sine', 0.04);
      break;
    case 'coin':
      tone(ac, 1318, t, 0.08, 'square', 0.025);
      tone(ac, 1976, t + 0.06, 0.12, 'square', 0.02);
      break;
    case 'purchase':
      tone(ac, 660, t, 0.09, 'triangle', 0.07);
      tone(ac, 880, t + 0.08, 0.09, 'triangle', 0.07);
      tone(ac, 1320, t + 0.16, 0.18, 'triangle', 0.06);
      break;
    case 'reward':
      [784, 988, 1175, 1568].forEach((f, i) => tone(ac, f, t + i * 0.07, 0.16, 'sine', 0.07));
      break;
    case 'league':
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(ac, f, t + i * 0.1, 0.32, 'triangle', 0.08));
      break;
    case 'error':
      tone(ac, 220, t, 0.16, 'sawtooth', 0.04, 150);
      break;
  }
}
