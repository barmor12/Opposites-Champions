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
}

const COLORS = {
  violet: 'bg-brand-violet',
  sky: 'bg-brand-sky',
  green: 'bg-brand-green',
  yellow: 'bg-brand-yellow',
  rainbow: 'bg-gradient-to-l from-brand-pink via-brand-violet to-brand-sky',
};
const SIZES = { sm: 'h-2.5', md: 'h-4', lg: 'h-6' };

export function ProgressBar({ value, max = 100, label, color = 'violet', size = 'md', showValue, className }: ProgressBarProps) {
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
        className={cn('w-full overflow-hidden rounded-full bg-white/80 shadow-inner ring-1 ring-black/5', SIZES[size])}
      >
        <motion.div
          className={cn('h-full rounded-full', COLORS[color])}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    </div>
  );
}
