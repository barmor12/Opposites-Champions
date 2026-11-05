import { Check } from 'lucide-react';

export interface ChipOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  disabled?: boolean;
}

interface BaseProps<T extends string | number> {
  options: ReadonlyArray<ChipOption<T>>;
  name: string;
  size?: 'sm' | 'md';
}

const base =
  'inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40 disabled:cursor-not-allowed disabled:opacity-50';
const sizes = { sm: 'px-3 py-1 text-sm', md: 'px-4 py-2 text-sm' };
const on = 'border-brand-violet bg-brand-violet text-white shadow-sm';
const off = 'border-slate-200 bg-white text-slate-700 hover:border-brand-violet/60 hover:bg-brand-violet/5';

/** קבוצת צ'יפים – בחירה יחידה (radio). */
export function SingleChips<T extends string | number>({
  options,
  value,
  onChange,
  name,
  size = 'md',
}: BaseProps<T> & { value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`${base} ${sizes[size]} ${selected ? on : off}`}
            title={opt.hint}
          >
            {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
            {opt.label}
          </button>
        );
      })}
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
}: BaseProps<T> & { value: readonly T[]; onChange: (v: T[]) => void; allLabel?: string }) {
  const allSelected = options.every((o) => value.includes(o.value));
  const toggle = (v: T) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <div role="group" aria-label={name} className="flex flex-wrap gap-2">
      {allLabel && (
        <button
          type="button"
          aria-pressed={allSelected}
          onClick={() => onChange(allSelected ? [] : options.map((o) => o.value))}
          className={`${base} ${sizes[size]} ${
            allSelected ? 'border-brand-navy bg-brand-navy text-white' : 'border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
        >
          {allLabel}
        </button>
      )}
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="checkbox"
            aria-checked={selected}
            disabled={opt.disabled}
            onClick={() => toggle(opt.value)}
            className={`${base} ${sizes[size]} ${selected ? on : off}`}
            title={opt.hint}
          >
            {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
