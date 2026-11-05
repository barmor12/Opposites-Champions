import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { LazyImage } from './LazyImage';

import { characterSrc, type CharacterMood, type CharacterName } from '@/lib/assets';

export interface CharacterProps {
  name: CharacterName;
  mood?: CharacterMood;
  /** 'none' – הגודל נקבע ע״י className בלבד */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'auto' | 'none';
  animate?: 'float' | 'bounce' | 'wiggle' | 'none';
  className?: string;
  /** השהיה (שניות) כדי שדמויות לא ינועו בסנכרון */
  delay?: number;
}

const SIZES = { sm: 'size-20', md: 'size-28 sm:size-32', lg: 'size-36 sm:size-44', xl: 'size-44 sm:size-56', auto: 'size-20 sm:size-28 lg:size-32', none: '' };
const EMOJI: Record<CharacterName, string> = { sun: '☀️', moon: '🌙' };
const LABEL: Record<CharacterName, string> = { sun: 'שמש', moon: 'ירח' };

/** דמויות המשחק – שמש וירח (הפכים!) עם אנימציית ריחוף */
export function Character({ name, mood = 'happy', size = 'md', animate = 'float', className, delay = 0 }: CharacterProps) {
  const reduce = useReducedMotion();
  const motionProps =
    reduce || animate === 'none'
      ? {}
      : animate === 'float'
        ? { animate: { y: [0, -14, 0], rotate: [0, 3, 0, -3, 0] }, transition: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' as const, delay } }
        : animate === 'bounce'
          ? { animate: { y: [0, -18, 0], scale: [1, 1.05, 1] }, transition: { duration: 1.6, repeat: Infinity, ease: 'easeInOut' as const, delay } }
          : { animate: { rotate: [-5, 5, -5] }, transition: { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const, delay } };

  return (
    <motion.div className={cn('relative inline-block drop-shadow-[0_14px_22px_rgba(30,41,59,0.22)]', SIZES[size], className)} {...motionProps}>
      <LazyImage
        src={characterSrc(name, mood)}
        alt={LABEL[name]}
        eager
        skeleton={false}
        wrapperClassName="size-full"
        className="size-full object-contain"
        fallback={
          <span
            className={cn(
              'flex size-full items-center justify-center rounded-full leading-none',
              name === 'sun' ? 'bg-yellow-200/70' : 'bg-indigo-200/70',
            )}
            style={{ fontSize: '55%' }}
          >
            <span style={{ fontSize: 'min(10vw, 5rem)' }}>{EMOJI[name]}</span>
          </span>
        }
      />
    </motion.div>
  );
}
