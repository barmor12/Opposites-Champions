import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { TREASURE_BONUS } from '@oc/shared';
import { Confetti, LightRays } from '@/animations';
import { Button } from './_ui';
import { TreasureChestImage } from './TreasureChest';
import { cn } from './utils';

export interface TreasureOverlayProps {
  bonus?: number;
  onContinue: () => void;
}

const COINS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: 4 + ((i * 37) % 92),
  delay: (i % 9) * 0.37,
  size: 22 + (i % 4) * 8,
  star: i % 5 === 0,
  duration: 3 + (i % 3) * 0.6,
}));

function Coin({ size, star }: { size: number; star: boolean }) {
  if (star) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]">
        <defs>
          <radialGradient id="tc-star" cx="0.4" cy="0.35" r="0.7">
            <stop offset="0" stopColor="#fff7c2" />
            <stop offset="1" stopColor="#f59e0b" />
          </radialGradient>
        </defs>
        <path fill="url(#tc-star)" d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)]">
      <defs>
        <radialGradient id="tc-coin" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="0.6" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="19" fill="url(#tc-coin)" />
      <circle cx="20" cy="20" r="13" fill="none" stroke="#fde68a" strokeWidth="2.5" opacity="0.8" />
      <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="900" fill="#92400e">★</text>
      <ellipse cx="14" cy="12" rx="6" ry="3.5" fill="#fff" opacity="0.55" transform="rotate(-25 14 12)" />
    </svg>
  );
}

/** שכבת הישג מלאת-מסך – "מצאת את האוצר!" עם קרני אור ומטבעות יורדים */
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-indigo-950 via-violet-800 to-fuchsia-700 px-6 text-center text-white safe-bottom"
    >
      {/* קרני אור גדולות */}
      <LightRays color="rgb(253 224 71)" count={16} intensity={0.35} className="w-[220vmax] sm:w-[170vmax]" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 45%, rgb(250 204 21 / 0.35), transparent 70%)' }} />
      <Confetti active durationMs={4000} pieces={180} />
      {!reduced &&
        COINS.map((c) => (
          <span
            key={c.id}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 select-none animate-coin"
            style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s` }}
          >
            <Coin size={c.size} star={c.star} />
          </span>
        ))}

      <motion.div
        initial={{ scale: 0.3, rotate: -10, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.1 }}
        className="relative h-44 w-52 sm:h-60 sm:w-72"
      >
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-yellow-300/50 blur-2xl"
          animate={reduced ? undefined : { scale: [1, 1.3, 1], opacity: [0.5, 0.95, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
        <TreasureChestImage open className="relative h-full w-full drop-shadow-[0_18px_28px_rgba(0,0,0,0.45)]" />
      </motion.div>

      <motion.h2
        id="treasure-title"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="relative mt-4 text-fluid-hero font-black text-extrude"
      >
        מצאת את האוצר!
      </motion.h2>
      <motion.p
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 12 }}
        className={cn(
          'relative mt-4 rounded-full border-b-[5px] border-amber-700 bg-gradient-to-b from-yellow-200 via-yellow-300 to-amber-500 px-7 py-2 text-3xl font-black text-amber-950 ring-4 ring-white/90 sm:text-4xl',
          'shadow-[0_20px_40px_-12px_rgba(245,158,11,0.8),inset_0_2px_0_rgba(255,255,255,0.8)]',
        )}
      >
        +{bonus} בונוס
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="relative mt-4 text-xl font-bold text-violet-100 text-shadow-soft sm:text-2xl"
      >
        חמש תשובות נכונות ברצף – אלוף אמיתי!
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }} className="relative mt-8 w-full max-w-xs">
        <Button variant="success" size="xl" glow onClick={onContinue} className="w-full" icon={<ArrowLeft className="h-7 w-7" strokeWidth={3} />} autoFocus>
          המשך
        </Button>
      </motion.div>
    </motion.div>
  );
}
