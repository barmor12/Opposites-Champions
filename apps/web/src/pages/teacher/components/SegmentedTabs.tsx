import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { HIT_AREA, radioGroupKeyDown } from './a11y';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/**
 * טאבים מקוטעים (segmented control) עם "גלולה" שמחליקה בין האפשרויות.
 * סמנטית זו בחירה יחידה (radiogroup) – לא tablist, כי אין tabpanel; ניווט במקשי חצים.
 */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const reduce = useReducedMotion();
  const layoutId = `seg-${label}`;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={radioGroupKeyDown}
      className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-slate-200/70 p-1 shadow-[inset_0_1px_2px_rgba(30,41,59,.12)] backdrop-blur', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="radio"
            type="button"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative min-h-0 shrink-0 whitespace-nowrap rounded-full font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-violet/30',
              size === 'sm' ? cn('px-3 py-1.5 text-xs', HIT_AREA.y8) : cn('px-4 py-2 text-sm', HIT_AREA.y4),
              active ? 'text-brand-navy' : 'text-slate-600 hover:text-brand-navy',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 32 }}
                className="absolute inset-0 rounded-full bg-white shadow-[0_2px_6px_rgba(30,41,59,.14),0_1px_0_rgba(255,255,255,.8)_inset]"
                aria-hidden
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {opt.label}
              {opt.count !== undefined && (
                <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-brand-violet/10 text-violet-700' : 'bg-slate-300/60 text-slate-600')}>{opt.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
