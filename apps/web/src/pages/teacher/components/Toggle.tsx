import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  name?: string;
  icon?: React.ReactNode;
}

/** מתג הפעלה/כיבוי נגיש, בסגנון switch עם עומק. */
export function Toggle({ checked, onChange, label, description, disabled, name, icon }: ToggleProps) {
  const reduce = useReducedMotion();
  return (
    <label
      className={cn(
        'group flex items-center justify-between gap-4 rounded-2xl border bg-white/80 px-4 py-3 transition-[border-color,box-shadow,background-color] duration-200',
        checked ? 'border-emerald-200/80 bg-emerald-50/40' : 'border-slate-200/80',
        disabled ? 'opacity-60' : 'cursor-pointer hover:border-brand-violet/40 hover:shadow-[0_8px_20px_-12px_rgba(139,92,246,.5)]',
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl transition-colors', checked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')} aria-hidden>
            {icon}
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-brand-navy">{label}</span>
          {description && <span className="block text-xs leading-5 text-slate-500">{description}</span>}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        name={name}
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 min-h-0 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          'shadow-[inset_0_2px_4px_rgba(30,41,59,.18)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-violet/30',
          checked ? 'bg-linear-to-b from-emerald-400 to-green-500' : 'bg-slate-300',
        )}
      >
        <motion.span
          layout={!reduce}
          transition={{ type: 'spring', stiffness: 600, damping: 32 }}
          className={cn('block size-6 rounded-full bg-white shadow-[0_1px_3px_rgba(30,41,59,.35)]', checked ? 'ms-auto' : 'me-auto')}
        />
      </button>
    </label>
  );
}
