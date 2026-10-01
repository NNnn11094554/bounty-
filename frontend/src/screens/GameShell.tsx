import { OfficeScreen } from './office/OfficeScreen';

/** Оболочка игры после входа: экраны, нижнее меню, модалки. */
export function GameShell() {
  return (
    <div className="pt-safe pb-safe mx-auto flex h-full max-w-[520px] flex-col overflow-hidden">
      <main className="min-h-0 flex-1">
        <OfficeScreen />
      </main>
    </div>
  );
}
