import type { LeagueInfo } from '@meowgul/shared';
import { CharacterImage } from './CharacterImage';

interface Props {
  league: LeagueInfo;
  size: number;
  /** лига ещё не достигнута — пунктирное кольцо и замок (картинка не меняется) */
  locked?: boolean;
}

/** Персонаж «в образе лиги»: та же картинка, меняются только кольцо и свечение вокруг. */
export function LeagueAvatar({ league, size, locked }: Props) {
  const rainbow = league.color === 'rainbow';
  const ring = rainbow ? '#ffc93c' : league.color;
  return (
    <div
      className="relative"
      style={{ width: size, height: size, ['--ring' as string]: ring }}
      data-league={league.id}
    >
      <div className="cat-glow pointer-events-none absolute inset-[-18%] rounded-full" />
      {rainbow && !locked && <div className="cat-ring-rainbow absolute inset-[-5px] rounded-full" />}
      <div
        className={`absolute inset-0 overflow-hidden rounded-full bg-night-800 ${rainbow || locked ? '' : 'cat-ring'}`}
        style={
          locked
            ? {
                boxShadow: `0 0 0 3px ${ring}`,
                outline: '2px dashed rgba(255,255,255,0.35)',
                outlineOffset: 5,
              }
            : undefined
        }
      >
        <CharacterImage size={size} className="h-full w-full" />
      </div>
      {locked && (
        <span className="absolute bottom-1 right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-night-800 bg-night-600 text-white shadow-card">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.6" />
            <rect x="5" y="10.5" width="14" height="10.5" rx="2.4" fill="currentColor" />
          </svg>
        </span>
      )}
    </div>
  );
}
