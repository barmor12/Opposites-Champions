import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  color?: 'violet' | 'sky' | 'green' | 'yellow' | 'rainbow';
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  className?: string;
  /** פסים נעים על המילוי (ברירת מחדל: כן) */
  striped?: boolean;
}

const COLORS = {
  violet: 'from-violet-400 via-violet-500 to-violet-600',
  sky: 'from-sky-300 via-sky-400 to-sky-500',
  green: 'from-green-400 via-green-500 to-emerald-600',
  yellow: 'from-yellow-300 via-amber-400 to-amber-500',
  rainbow: 'from-brand-pink via-brand-violet to-brand-sky',
};
const SIZES = { sm: 'h-3', md: 'h-4.5', lg: 'h-7' };

/** פס התקדמות מבריק: מסילה שקועה, מילוי בגרדיאנט עם גלוס ופסים נעים */
export function ProgressBar({ value, max = 100, label, color = 'violet', size = 'md', showValue, className, striped = true }: ProgressBarProps) {
  const reduce = useReducedMotion();
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-sm sm:text-base font-bold text-brand-navy/80">
          {label && <span>{label}</span>}
          {showValue && <span dir="ltr">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-gradient-to-b from-slate-200/90 to-white/90 ring-1 ring-black/5',
          'shadow-[inset_0_2px_5px_rgba(30,41,59,0.14)]',
          SIZES[size],
        )}
      >
        <motion.div
          className={cn('relative h-full rounded-full bg-gradient-to-l shadow-[0_2px_8px_-2px_rgba(30,41,59,0.35)]', COLORS[color])}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
        >
          {striped && <span aria-hidden className={cn('absolute inset-0 rounded-full stripes-overlay opacity-80', !reduce && 'animate-stripes')} />}
          <span aria-hidden className="absolute inset-x-1 top-[2px] h-[40%] rounded-full bg-gradient-to-b from-white/70 to-white/10" />
        </motion.div>
      </div>
    </div>
  );
}
