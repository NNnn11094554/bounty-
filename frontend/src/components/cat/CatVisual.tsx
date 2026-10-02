import { DEFAULT_SKIN_ID } from '@meowgul/shared';
import { forwardRef, type Ref } from 'react';
import { skinRarity, skinStyle, skinVars, type ParticleKind } from '../../game/skins';
import { CharacterImage } from '../CharacterImage';
import { Accessory } from './Accessory';

export interface CatVisualRefs {
  gaze?: Ref<HTMLDivElement>;
  dance?: Ref<HTMLDivElement>;
  tilt?: Ref<HTMLDivElement>;
  accessory?: Ref<SVGSVGElement>;
  aura?: Ref<HTMLDivElement>;
}

interface Props {
  size: number;
  skinId: string;
  /** цвет лиги — кольцо стартового скина (rainbow — переливающееся) */
  leagueColor?: string;
  refs?: CatVisualRefs;
}

/** Частицы, кружащие вокруг кота (у скинов редкости RARE и выше). */
function Orbit({ kind, count, size }: { kind: ParticleKind; count: number; size: number }) {
  const r = size * 0.6;
  return (
    <div className="cat-orbit pointer-events-none absolute inset-0">
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * 360;
        return (
          <span
            key={i}
            className={`orbit-pt pt pt-${kind}`}
            style={{
              transform: `rotate(${a}deg) translateY(${-r}px) rotate(${-a}deg)`,
              animationDelay: `${(-i * 0.7).toFixed(1)}s`,
            }}
          >
            {kind === 'code' ? (i % 2 ? '1' : '0') : null}
          </span>
        );
      })}
    </div>
  );
}

const ORBIT_COUNT = { COMMON: 0, RARE: 4, EPIC: 5, LEGENDARY: 6, MYTHIC: 8 } as const;

/**
 * Кот со скином: ореол по редкости, кружащие частицы, кольцо, портрет (картинка без изменений) и
 * аксессуар над головой. Слои для анимаций: gaze (взгляд за пальцем) → idle (дыхание, парение) →
 * dance → tilt (реакция на тап). Только оформление — никаких событий ввода.
 */
export const CatVisual = forwardRef<HTMLDivElement, Props>(function CatVisual(
  { size, skinId, leagueColor, refs },
  ref,
) {
  const style = skinStyle(skinId);
  const rarity = skinRarity(skinId);
  const rainbow = skinId === DEFAULT_SKIN_ID && leagueColor === 'rainbow';
  const orbitCount = style.orbit ? ORBIT_COUNT[rarity] : 0;
  return (
    <div
      ref={ref}
      className={`cat-visual rarity-${rarity.toLowerCase()} pointer-events-none absolute inset-0`}
      data-skin={skinId}
      style={skinVars(skinId, size, leagueColor)}
    >
      <div ref={refs?.aura} className="cat-aura cat-glow absolute inset-[-22%] rounded-full" />
      {(rarity === 'LEGENDARY' || rarity === 'MYTHIC') && (
        <div className="cat-aura-conic absolute inset-[-12%] rounded-full" />
      )}
      {orbitCount > 0 && style.orbit && <Orbit kind={style.orbit} count={orbitCount} size={size} />}
      <div ref={refs?.gaze} className="cat-gaze absolute inset-0">
        <div className="cat-idle absolute inset-0">
          <div ref={refs?.dance} className="absolute inset-0">
            <div ref={refs?.tilt} className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
              <div
                className={`cat-ring absolute inset-0 rounded-full ${rainbow ? 'cat-ring-rainbow' : ''}`}
              />
              <div className="absolute inset-[6px] overflow-hidden rounded-full bg-night-900">
                <CharacterImage size={size} src={style.asset} className="cat-img h-full w-full" />
              </div>
              <Accessory ref={refs?.accessory} kind={style.accessory} size={size} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
