import { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export interface PageBackgroundProps {
  variant?: 'day' | 'sunset' | 'night';
  /** להציג קשת (מתאים למסך הפתיחה והתוצאות) */
  rainbow?: boolean;
  className?: string;
}

const GRADIENTS = {
  day: 'bg-gradient-to-b from-sky-300 via-sky-100 to-yellow-50',
  sunset: 'bg-gradient-to-b from-violet-300 via-pink-100 to-orange-50',
  night: 'bg-gradient-to-b from-indigo-900 via-violet-800 to-indigo-500',
};

function Cloud({ className, style, delay = 0, duration = 70 }: { className?: string; style?: React.CSSProperties; delay?: number; duration?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 200 110"
      aria-hidden
      className={cn('absolute text-white/90 drop-shadow-[0_6px_10px_rgba(56,189,248,0.25)]', className)}
      style={style}
      initial={{ x: 0 }}
      animate={reduce ? undefined : { x: ['0vw', '-12vw', '0vw'] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <ellipse cx="60" cy="70" rx="55" ry="34" fill="currentColor" />
      <ellipse cx="110" cy="52" rx="50" ry="42" fill="currentColor" />
      <ellipse cx="150" cy="72" rx="45" ry="32" fill="currentColor" />
      <rect x="20" y="70" width="160" height="35" rx="18" fill="currentColor" />
    </motion.svg>
  );
}

function Star({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('absolute text-brand-yellow drop-shadow animate-twinkle', className)}
      style={{ animationDelay: `${delay}s` }}
    >
      <path fill="currentColor" d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
    </svg>
  );
}

function Rainbow({ className }: { className?: string }) {
  const bands = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#8b5cf6'];
  return (
    <svg viewBox="0 0 400 200" aria-hidden className={cn('absolute opacity-70', className)}>
      {bands.map((c, i) => (
        <path key={c} d={`M${20 + i * 14} 200 A ${180 - i * 14} ${180 - i * 14} 0 0 1 ${380 - i * 14} 200`} fill="none" stroke={c} strokeWidth="13" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/** רקע עמוד – שמיים עם עננים, כוכבים וקשת; מכבד prefers-reduced-motion */
export function PageBackground({ variant = 'day', rainbow = true, className }: PageBackgroundProps) {
  const stars = useMemo(
    () => [
      { c: 'top-[8%] start-[6%] size-6', d: 0 },
      { c: 'top-[14%] end-[10%] size-8', d: 0.8 },
      { c: 'top-[32%] start-[14%] size-4', d: 1.5 },
      { c: 'top-[40%] end-[6%] size-5', d: 0.4 },
      { c: 'top-[62%] start-[4%] size-5', d: 2 },
      { c: 'top-[70%] end-[14%] size-7', d: 1.1 },
    ],
    [],
  );
  return (
    <div aria-hidden className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', GRADIENTS[variant], className)}>
      {rainbow && <Rainbow className="-bottom-10 start-1/2 w-[140vw] max-w-[900px] -translate-x-1/2 sm:w-[90vw]" />}
      <Cloud className="top-[6%] -start-10 w-44 sm:w-56" delay={0} duration={80} />
      <Cloud className="top-[22%] end-[-6%] w-36 opacity-80 sm:w-48" delay={6} duration={95} />
      <Cloud className="top-[55%] start-[10%] w-28 opacity-70 sm:w-40" delay={12} duration={110} />
      <Cloud className="bottom-[14%] end-[8%] w-40 opacity-75 sm:w-52" delay={3} duration={90} />
      {stars.map((s) => (
        <Star key={s.c} className={s.c} delay={s.d} />
      ))}
    </div>
  );
}
