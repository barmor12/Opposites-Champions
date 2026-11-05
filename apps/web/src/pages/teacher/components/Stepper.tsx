// מבוסס על 21st.dev — Animated Progress Stepper (shadcnspace): קו התקדמות קפיצי, טבעת פועמת על השלב הפעיל,
// ומעבר אייקון→✓ עם AnimatePresence. מותאם ל־RTL (origin-right) ולמובייל (תוויות מתחת לאייקונים).
import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export interface StepperStep {
  key: string;
  label: string;
  icon: LucideIcon;
  /** תווית משנה לשלב הפעיל (למשל "מושהה") */
  tag?: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  /** אינדקס השלב הנוכחי; -1 = אף שלב (למשל חדר שבוטל). מעבר לאינדקס האחרון = הכול הושלם. */
  current: number;
  /** כל השלבים "כבויים" (חדר שבוטל/פג) */
  muted?: boolean;
  /** לחיצה על שלב (למשל גלילה לקטע בטופס) */
  onSelect?: (index: number) => void;
  /** צבע השלב הפעיל */
  tone?: 'violet' | 'green';
  className?: string;
  label?: string;
}

export function Stepper({ steps, current, muted, onSelect, tone = 'violet', className, label = 'שלבים' }: StepperProps) {
  const reduce = useReducedMotion();
  const n = steps.length;
  const progress = n > 1 ? Math.max(0, Math.min(1, current / (n - 1))) : 0;
  const inset = `${50 / n}%`;
  const activeBg = tone === 'green' ? 'from-emerald-400 to-green-600 shadow-emerald-500/50' : 'from-violet-500 to-fuchsia-500 shadow-violet-500/50';
  const activeRing = tone === 'green' ? 'ring-emerald-400/50' : 'ring-violet-400/50';
  const Wrapper = onSelect ? 'button' : 'div';

  return (
    <nav aria-label={label} className={cn('relative', muted && 'opacity-50 grayscale', className)}>
      {/* מסילה */}
      <div className="absolute top-5 h-1 rounded-full bg-slate-200/90 sm:top-6" style={{ left: inset, right: inset }} aria-hidden />
      <motion.div
        aria-hidden
        className="absolute top-5 h-1 origin-right rounded-full bg-linear-to-l from-brand-green to-emerald-400 sm:top-6"
        style={{ left: inset, right: inset }}
        initial={false}
        animate={{ scaleX: progress }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 22 }}
      />
      <ol className="relative flex items-start">
        {steps.map((s, i) => {
          const active = i === current;
          const done = i < current;
          const Icon = s.icon;
          return (
            <li key={s.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center" aria-current={active ? 'step' : undefined}>
              <Wrapper
                type={onSelect ? 'button' : undefined}
                onClick={onSelect ? () => onSelect(i) : undefined}
                aria-label={onSelect ? `מעבר לשלב ${i + 1}: ${s.label}` : undefined}
                className={cn(
                  'relative z-10 grid size-10 min-h-0 place-items-center rounded-full sm:size-12',
                  onSelect && 'cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-violet/30',
                )}
              >
                <span
                  className={cn(
                    'absolute inset-0 rounded-full transition-colors duration-300',
                    done && 'bg-brand-green shadow-[0_6px_14px_-6px_rgba(34,197,94,.8)]',
                    active && cn('bg-linear-to-br shadow-lg', activeBg),
                    !done && !active && 'bg-white ring-2 ring-slate-200 shadow-sm',
                  )}
                />
                {active && !reduce && (
                  <motion.span
                    aria-hidden
                    className={cn('absolute inset-0 rounded-full ring-2', activeRing)}
                    animate={{ scale: [1, 1.45, 1], opacity: [1, 0.15, 1] }}
                    transition={{ duration: 2.2, repeat: Infinity, repeatType: 'mirror' }}
                  />
                )}
                <motion.span className="relative" animate={{ scale: active ? 1.1 : 1 }} transition={{ type: 'spring', stiffness: 320, damping: 18 }}>
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                      <motion.span
                        key="check"
                        initial={reduce ? false : { scale: 0, rotate: -90, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={reduce ? undefined : { scale: 0, rotate: 90, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        className="flex text-white"
                      >
                        <Check className="size-5" strokeWidth={3} aria-hidden />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="icon"
                        initial={reduce ? false : { scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={reduce ? undefined : { scale: 0, opacity: 0 }}
                        className={cn('flex', active ? 'text-white' : 'text-slate-500')}
                      >
                        <Icon className="size-4 sm:size-5" aria-hidden />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.span>
              </Wrapper>
              <span className={cn('block max-w-full truncate px-0.5 text-[11px] font-bold sm:text-sm', active ? 'text-brand-navy' : done ? 'text-emerald-700' : 'text-slate-500')}>{s.label}</span>
              {s.tag && active && <span className="-mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 sm:text-[11px]">{s.tag}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
