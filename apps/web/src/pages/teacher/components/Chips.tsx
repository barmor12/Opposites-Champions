import { Check } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { HIT_AREA, radioGroupKeyDown } from './a11y';

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface BaseProps<T extends string | number> {
  options: ReadonlyArray<ChipOption<T>>;
  name: string;
  size?: 'sm' | 'md';
  /** מזהה אלמנט שמתאר את הקבוצה (למשל הודעת שגיאה) */
  describedBy?: string;
  /** הקבוצה במצב שגיאה */
  invalid?: boolean;
}

const base =
  'relative inline-flex min-h-0 items-center gap-1.5 rounded-full font-semibold transition-[color,background-color,box-shadow,border-color] duration-200 select-none ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-violet/30 disabled:cursor-not-allowed disabled:opacity-50';
// גובה נראה 36/40px + הרחבת שטח לחיצה ל־44px
const sizes = { sm: cn('h-9 px-3.5 text-[13px]', HIT_AREA.y4), md: cn('h-10 px-4 text-sm', HIT_AREA.y2) };
const on =
  'border border-violet-600/80 bg-linear-to-b from-violet-600 to-violet-700 text-white ' +
  'shadow-[0_6px_16px_-6px_rgba(139,92,246,.75),inset_0_1px_0_rgba(255,255,255,.35)] ring-2 ring-violet-300/50';
const off =
  'border border-slate-200/90 bg-white text-slate-700 shadow-[0_1px_2px_rgba(30,41,59,.06),0_4px_10px_-6px_rgba(30,41,59,.18)] ' +
  'hover:border-violet-300 hover:text-violet-700 hover:shadow-[0_6px_14px_-6px_rgba(139,92,246,.4)]';

function Chip({
  selected,
  disabled,
  onClick,
  role,
  label,
  hint,
  icon,
  size,
  className,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  role: 'radio' | 'checkbox' | undefined;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  size: 'sm' | 'md';
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      role={role}
      aria-checked={role ? selected : undefined}
      aria-pressed={role ? undefined : selected}
      disabled={disabled}
      onClick={onClick}
      whileTap={reduce || disabled ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cn(base, sizes[size], selected ? on : off, className)}
      title={hint}
    >
      {selected ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : icon ? <span className="inline-flex opacity-70" aria-hidden>{icon}</span> : null}
      {label}
    </motion.button>
  );
}

/** קבוצת צ'יפים – בחירה יחידה (radio). */
export function SingleChips<T extends string | number>({
  options,
  value,
  onChange,
  name,
  size = 'md',
  describedBy,
  invalid,
}: BaseProps<T> & { value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={name} aria-describedby={describedBy} aria-invalid={invalid || undefined} onKeyDown={radioGroupKeyDown} className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <Chip
          key={String(opt.value)}
          role="radio"
          selected={opt.value === value}
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
          label={opt.label}
          hint={opt.hint}
          icon={opt.icon}
          size={size}
        />
      ))}
    </div>
  );
}

/** קבוצת צ'יפים – בחירה מרובה (checkbox). */
export function MultiChips<T extends string | number>({
  options,
  value,
  onChange,
  name,
  size = 'md',
  allLabel,
  describedBy,
  invalid,
}: BaseProps<T> & { value: readonly T[]; onChange: (v: T[]) => void; allLabel?: string }) {
  const allSelected = options.every((o) => value.includes(o.value));
  const toggle = (v: T) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div role="group" aria-label={name} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="flex flex-wrap gap-2">
      {allLabel && (
        <Chip
          role={undefined}
          selected={allSelected}
          onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}
          label={allLabel}
          size={size}
          className={allSelected ? 'from-slate-700 to-brand-navy border-slate-700 ring-slate-300/60 shadow-[0_6px_16px_-6px_rgba(30,41,59,.6)]' : 'border-dashed'}
        />
      )}
      {options.map((opt) => (
        <Chip
          key={String(opt.value)}
          role="checkbox"
          selected={value.includes(opt.value)}
          disabled={opt.disabled}
          onClick={() => toggle(opt.value)}
          label={opt.label}
          hint={opt.hint}
          icon={opt.icon}
          size={size}
        />
      ))}
    </div>
  );
}
