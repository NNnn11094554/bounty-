import { cipherPress, useCipherInput } from '../../game/cipher';
import type { SubScreen } from '../../store/nav';
import { CipherBanner, MorseOverlay } from './CipherBanner';
import { OfficeScreen } from './OfficeScreen';

interface Props {
  open: (screen: SubScreen) => void;
}

/** Вкладка «Офис»: главный экран и шифр дня (в режиме шифра нажатия на кота — азбука Морзе). */
export function OfficeTab({ open }: Props) {
  const cipherActive = useCipherInput((s) => s.active);
  return (
    <OfficeScreen
      onOpenBoosts={() => open('boosts')}
      onOpenLeagues={() => open('leagues')}
      onOpenProfile={() => open('profile')}
      onOpenSettings={() => open('settings')}
      onOpenCollection={() => open('collection')}
      dailyBanner={<CipherBanner />}
      onCatPress={cipherActive ? cipherPress : undefined}
      catOverlay={cipherActive ? <MorseOverlay /> : undefined}
    />
  );
}
