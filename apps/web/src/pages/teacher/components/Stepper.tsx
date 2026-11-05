import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export interface StepperStep {
  key: string;
  label: string;
  icon: LucideIcon;
  /** תווית משנה (למשל "מושהה") */
  tag?: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  /** אינדקס השלב הנוכחי; -1 = אף שלב (למשל חדר שבוטל) */
  current: number;
  /** כל השלבים "כבויים" (חדר שבוטל/פג) */
  muted?: boolean;
  className?: string;
}

/** ציר־זמן מצבים אופקי (ממתינים → ספירה → שאלות → תוצאות). */
export function Stepper({ steps, current, muted, className }: StepperProps) {
  const reduce = useReducedMotion();
  return (
    <ol className={cn('flex items-center gap-1 sm:gap-2', muted && 'opacity-60 grayscale', className)} aria-label="שלבי המשחק">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = step.icon;
        return (
          <li key={step.key} className={cn('flex min-w-0 items-center', i < steps.length - 1 && 'flex-1')} aria-current={active ? 'step' : undefined}>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'relative grid size-9 shrink-0 place-items-center rounded-full ring-4 transition-colors sm:size-10',
                  done && 'bg-brand-green text-white ring-emerald-100',
                  active && 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white ring-violet-200 shadow-[0_8px_18px_-6px_rgba(139,92,246,.7)]',
                  !done && !active && 'bg-white text-slate-400 ring-slate-100',
                )}
              >
                {active && !reduce && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-violet-400/40"
                    animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
                {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Icon className="relative size-4 sm:size-[18px]" aria-hidden />}
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-xs font-bold sm:text-sm', active ? 'text-brand-navy' : done ? 'text-emerald-700' : 'text-slate-400')}>{step.label}</span>
                {step.tag && active && <span className="block text-[11px] font-semibold text-amber-600">{step.tag}</span>}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="mx-2 h-1 min-w-4 flex-1 overflow-hidden rounded-full bg-slate-200/80 sm:mx-3" aria-hidden>
                <motion.span
                  className="block h-full rounded-full bg-linear-to-l from-brand-green to-emerald-400"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: reduce ? 0 : 0.5, ease: 'easeOut' }}
                />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
