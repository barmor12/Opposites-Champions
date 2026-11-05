import { forwardRef, useId, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { CircleX } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface InputProps extends Omit<ComponentPropsWithoutRef<'input'>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  size?: 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  wrapperClassName?: string;
}

const SIZES = {
  md: 'min-h-12 text-base px-4 rounded-2xl',
  lg: 'min-h-14 text-lg px-5 rounded-2xl',
  xl: 'min-h-16 text-2xl px-5 rounded-3xl',
};

/** שדה קלט גדול ונגיש, RTL כברירת מחדל */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, size = 'lg', icon, className, wrapperClassName, id, dir, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `in-${autoId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <div className={cn('flex flex-col gap-1.5 text-start', wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="font-bold text-brand-navy text-base sm:text-lg">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-slate-400" aria-hidden>
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          dir={dir}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            'w-full bg-white text-brand-navy placeholder:text-slate-400 border-[3px] transition-colors',
            'border-slate-200 hover:border-sky-300 focus:border-brand-violet focus:outline-none shadow-sm',
            error && 'border-rose-400 focus:border-rose-500 bg-rose-50/40',
            Boolean(icon) && 'pe-12',
            SIZES[size],
            className,
          )}
          {...rest}
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-rose-600 font-semibold text-sm sm:text-base">
          <CircleX className="size-5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-slate-500 text-sm">{hint}</p>
      ) : null}
    </div>
  );
});
