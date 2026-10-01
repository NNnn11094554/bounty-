import { cipherPress, useCipherInput } from '../../game/cipher';
import { CipherBanner, MorseOverlay } from './CipherBanner';
import { OfficeScreen } from './OfficeScreen';

interface Props {
  onOpenBoosts: () => void;
  onOpenLeagues: () => void;
}

/** Вкладка «Офис»: главный экран и шифр дня (в режиме шифра нажатия на кота — азбука Морзе). */
export function OfficeTab({ onOpenBoosts, onOpenLeagues }: Props) {
  const cipherActive = useCipherInput((s) => s.active);
  return (
    <OfficeScreen
      onOpenBoosts={onOpenBoosts}
      onOpenLeagues={onOpenLeagues}
      dailyBanner={<CipherBanner />}
      onCatPress={cipherActive ? cipherPress : undefined}
      catOverlay={cipherActive ? <MorseOverlay /> : undefined}
    />
  );
}
