import { motion } from 'framer-motion';
import { CharacterImage } from '../components/CharacterImage';
import { useT } from '../i18n';

/** Сплэш с логотипом и лоадером, пока грузятся данные игрока. */
export function SplashScreen() {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6" data-testid="splash">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="relative"
      >
        <div className="absolute inset-[-28px] rounded-full bg-[radial-gradient(circle,rgba(255,138,61,0.45),transparent_68%)]" />
        <div className="breathe relative h-44 w-44 overflow-hidden rounded-full shadow-glow ring-4 ring-gold">
          <CharacterImage size={176} className="h-full w-full" />
        </div>
      </motion.div>
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-[40px] font-black leading-none tracking-tight">{t('app.name')}</h1>
        <p className="text-sm font-semibold text-white/55">{t('boot.loading')}</p>
      </div>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
        <div className="loader-bar h-full w-1/3 rounded-full bg-progress" />
      </div>
    </div>
  );
}
