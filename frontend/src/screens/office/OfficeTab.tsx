import { cipherPress, useCipherInput } from '../../game/cipher';
import type { SubScreen, Tab } from '../../store/nav';
import { CipherBanner, MorseOverlay } from './CipherBanner';
import { OfficeScreen } from './OfficeScreen';

interface Props {
  open: (screen: SubScreen) => void;
  onOpenTab: (tab: Tab) => void;
}

/** Вкладка «Офис»: главный экран и шифр дня (в режиме шифра нажатия на кота — азбука Морзе). */
export function OfficeTab({ open, onOpenTab }: Props) {
  const cipherActive = useCipherInput((s) => s.active);
  return (
    <OfficeScreen
      onOpenBoosts={() => open('boosts')}
      onOpenMine={() => open('mine')}
      onOpenEarn={() => open('earn')}
      onOpenLeagues={() => open('leagues')}
      onOpenProfile={() => onOpenTab('profile')}
      onOpenSettings={() => open('settings')}
      dailyBanner={<CipherBanner />}
      onCatPress={cipherActive ? cipherPress : undefined}
      catOverlay={cipherActive ? <MorseOverlay /> : undefined}
    />
  );
}
