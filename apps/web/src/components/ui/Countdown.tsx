import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { COUNTDOWN_SECONDS } from '@oc/shared';
import { cn } from '@/lib/cn';
import { useConfettiBursts, LightRays } from '@/animations';

export interface CountdownProps {
  /** זמן שרת (epoch ms) שבו המשחק מתחיל */
  startsAt: number;
  seconds?: number;
  serverOffsetMs?: number;
  onDone?: () => void;
  className?: string;
}

const ORBS = [
  'from-green-300 via-green-500 to-emerald-700 shadow-[0_30px_60px_-20px_rgba(21,128,61,0.7)]',
  'from-orange-300 via-orange-500 to-orange-700 shadow-[0_30px_60px_-20px_rgba(194,65,12,0.7)]',
  'from-violet-300 via-violet-500 to-violet-800 shadow-[0_30px_60px_-20px_rgba(109,40,217,0.7)]',
  'from-pink-300 via-rose-500 to-rose-700 shadow-[0_30px_60px_-20px_rgba(190,18,60,0.7)]',
];

/** ספירה לאחור גדולה 3-2-1 → "יאללה!" מסונכרנת לשעון השרת – ספרות תלת־ממדיות על כדור זוהר + פרץ קונפטי */
export function Countdown({ startsAt, seconds = COUNTDOWN_SECONDS, serverOffsetMs = 0, onDone, className }: CountdownProps) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState<number>(() => Math.max(0, Math.ceil((startsAt - (Date.now() + serverOffsetMs)) / 1000)));
  const [confetti, fire] = useConfettiBursts({ particleCount: 90, startVelocity: 30, spread: 120, size: 1.1 });
  const firedRef = useRef(false);

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

  useEffect(() => {
    if (value === 0 && !firedRef.current) {
      firedRef.current = true;
      fire(50, 50);
    }
  }, [value, fire]);

  const go = value <= 0;
  const label = go ? 'יאללה!' : String(value);
  const orb = ORBS[Math.min(ORBS.length - 1, go ? ORBS.length - 1 : seconds - value)] ?? ORBS[0];

  return (
    <div role="timer" aria-live="assertive" aria-atomic className={cn('relative flex flex-col items-center justify-center gap-5 sm:gap-7', className)}>
      <p className="text-fluid-title font-black text-brand-navy/80 text-shadow-pop">{go ? 'מתחילים!' : 'המשחק מתחיל בעוד…'}</p>
      <div className="relative grid place-items-center">
        <LightRays color="rgb(255 255 255)" intensity={0.5} className="w-[230%]" />
        {!reduce && <span aria-hidden className="absolute inset-0 rounded-full bg-white/60 animate-pulse-ring" />}
        {confetti}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={label}
            initial={reduce ? { opacity: 0 } : { scale: 0.3, opacity: 0, rotate: -14 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { scale: 1.5, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            className={cn(
              'relative grid size-[11.5rem] place-items-center rounded-full bg-gradient-to-b text-white ring-[6px] ring-white/80 sm:size-60 lg:size-72',
              'shadow-[inset_0_6px_0_rgba(255,255,255,0.45),inset_0_-14px_24px_rgba(0,0,0,0.25)]',
              orb,
            )}
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-[18%] top-[6%] h-[30%] rounded-full bg-gradient-to-b from-white/70 to-transparent blur-[2px]" />
            <span className={cn('relative font-black leading-none text-extrude', go ? 'text-[2.4rem] sm:text-6xl lg:text-7xl' : 'text-fluid-count')} dir={go ? 'rtl' : 'ltr'}>
              {label}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
