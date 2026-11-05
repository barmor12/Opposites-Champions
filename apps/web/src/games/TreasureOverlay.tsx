import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { TREASURE_BONUS } from '@oc/shared';
import { Confetti } from '@/animations';
import { Button } from './_ui';
import { TreasureChestImage } from './TreasureChest';

export interface TreasureOverlayProps {
  bonus?: number;
  onContinue: () => void;
}

const COINS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  left: 8 + ((i * 37) % 84),
  delay: (i % 8) * 0.12,
  size: 22 + (i % 3) * 10,
  emoji: i % 4 === 0 ? '⭐' : '🪙',
}));

/** שכבת הישג מלאת-מסך – "מצאת את האוצר!" */
export function TreasureOverlay({ bonus = TREASURE_BONUS, onContinue }: TreasureOverlayProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onContinue]);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="treasure-title"
      data-testid="treasure-overlay"
      dir="rtl"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-indigo-900 via-violet-800 to-fuchsia-700 px-6 text-center text-white"
    >
      <Confetti active durationMs={4000} pieces={180} />
      {!reduced &&
        COINS.map((c) => (
          <motion.span
            key={c.id}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 select-none"
            style={{ left: `${c.left}%`, fontSize: c.size }}
            initial={{ y: -60, opacity: 0, rotate: 0 }}
            animate={{ y: '110vh', opacity: [0, 1, 1, 0.6], rotate: 360 }}
            transition={{ duration: 3.2, delay: c.delay, repeat: Infinity, ease: 'linear' }}
          >
            {c.emoji}
          </motion.span>
        ))}

      <motion.div
        initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
        className="relative h-44 w-52 sm:h-56 sm:w-64"
      >
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-yellow-300/40 blur-2xl"
          animate={reduced ? undefined : { scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <TreasureChestImage open className="relative h-full w-full" />
      </motion.div>

      <motion.h2
        id="treasure-title"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="mt-4 text-4xl font-black drop-shadow-lg sm:text-6xl"
      >
        מצאת את האוצר!
      </motion.h2>
      <motion.p
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 12 }}
        className="mt-3 rounded-full bg-yellow-300 px-6 py-2 text-3xl font-black text-yellow-900 shadow-xl ring-4 ring-yellow-100 sm:text-4xl"
      >
        +{bonus} בונוס
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-4 text-xl font-bold text-violet-100 sm:text-2xl"
      >
        חמש תשובות נכונות ברצף – אלוף אמיתי!
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="mt-8">
        <Button variant="success" size="xl" onClick={onContinue} icon={<ArrowLeft className="h-7 w-7" strokeWidth={3} />} autoFocus>
          המשך
        </Button>
      </motion.div>
    </motion.div>
  );
}
