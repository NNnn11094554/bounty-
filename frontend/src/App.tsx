import { useEffect, useState } from 'react';
import { CharacterImage } from './components/CharacterImage';

type Health = 'checking' | 'ok' | 'down';

export function App() {
  const [health, setHealth] = useState<Health>('checking');

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/health', { signal: ctrl.signal })
      .then((r) => setHealth(r.ok ? 'ok' : 'down'))
      .catch(() => setHealth('down'));
    return () => ctrl.abort();
  }, []);

  return (
    <main className="flex h-full flex-col items-center justify-center gap-6 px-4">
      <div className="overflow-hidden rounded-full shadow-glow ring-4 ring-gold">
        <CharacterImage size={168} className="h-[168px] w-[168px]" />
      </div>
      <h1 className="text-4xl font-black tracking-tight">Meowgul</h1>
      <p className="text-sm text-white/60" data-testid="health">
        API: {health === 'checking' ? '…' : health === 'ok' ? 'online' : 'offline'}
      </p>
    </main>
  );
}
