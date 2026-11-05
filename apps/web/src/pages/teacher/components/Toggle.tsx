export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  name?: string;
}

/** מתג הפעלה/כיבוי נגיש, בסגנון switch. */
export function Toggle({ checked, onChange, label, description, disabled, name }: ToggleProps) {
  return (
    <label
      className={`flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors ${
        disabled ? 'opacity-60' : 'cursor-pointer hover:border-brand-violet/50'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-brand-navy">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        name={name}
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-violet/40 ${
          checked ? 'bg-brand-green' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? '-translate-x-6' : '-translate-x-1'
          }`}
        />
      </button>
    </label>
  );
}
