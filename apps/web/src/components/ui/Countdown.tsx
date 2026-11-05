import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { COUNTDOWN_SECONDS } from '@oc/shared';
import { cn } from '@/lib/cn';

export interface CountdownProps {
  /** זמן שרת (epoch ms) שבו המשחק מתחיל */
  startsAt: number;
  seconds?: number;
  serverOffsetMs?: number;
  onDone?: () => void;
  className?: string;
}

const COLORS = ['text-brand-green', 'text-brand-orange', 'text-brand-violet', 'text-rose-500'];

/** ספירה לאחור גדולה 3-2-1 → "יאללה!" מסונכרנת לשעון השרת */
export function Countdown({ startsAt, seconds = COUNTDOWN_SECONDS, serverOffsetMs = 0, onDone, className }: CountdownProps) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState<number>(() => Math.max(0, Math.ceil((startsAt - (Date.now() + serverOffsetMs)) / 1000)));

  useEffect(() => {
    let done = false;
    const tick = () => {
      const remaining = Math.ceil((startsAt - (Date.now() + serverOffsetMs)) / 1000);
      const next = Math.min(seconds, Math.max(0, remaining));
      setValue(next);
      if (next <= 0 && !done) {
        done = true;
        onDone?.();
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [startsAt, seconds, serverOffsetMs, onDone]);

  const label = value > 0 ? String(value) : 'יאללה!';
  return (
    <div role="timer" aria-live="assertive" aria-atomic className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <p className="text-xl font-bold text-brand-navy/80 sm:text-2xl">המשחק מתחיל בעוד…</p>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={label}
          initial={reduce ? { opacity: 0 } : { scale: 0.3, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={reduce ? { opacity: 0 } : { scale: 1.6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          className={cn(
            'grid size-40 place-items-center rounded-full bg-white shadow-pop sm:size-56',
            'font-black leading-none text-shadow-pop',
            value > 0 ? 'text-8xl sm:text-9xl' : 'text-4xl sm:text-6xl',
            COLORS[Math.min(COLORS.length - 1, value > 0 ? seconds - value : COLORS.length - 1)],
          )}
        >
          {label}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
