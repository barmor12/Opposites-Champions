import { AVATARS, AVATAR_LABELS, type AvatarId } from '@oc/shared';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from './Avatar';

export interface AvatarPickerProps {
  value: AvatarId | null;
  onChange: (id: AvatarId) => void;
  label?: string;
  error?: string | null;
  className?: string;
}

/** רשת 16 דמויות לבחירה, עם טבעת סביב הנבחרת */
export function AvatarPicker({ value, onChange, label = 'בחרו דמות', error, className }: AvatarPickerProps) {
  const reduce = useReducedMotion();
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="mb-2 font-bold text-base sm:text-lg text-brand-navy">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2 sm:gap-3">
        {AVATARS.map((id) => {
          const selected = value === id;
          return (
            <motion.button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={AVATAR_LABELS[id]}
              onClick={() => onChange(id)}
              whileHover={reduce ? undefined : { scale: 1.06 }}
              whileTap={reduce ? undefined : { scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              className={cn(
                'relative flex min-h-12 flex-col items-center gap-1 rounded-2xl p-2 sm:p-3 transition-colors border-[3px]',
                selected ? 'border-brand-violet bg-violet-50 shadow-pop' : 'border-transparent bg-white/70 hover:bg-white',
              )}
            >
              <Avatar id={id} size="md" className={cn(selected && 'ring-4 ring-brand-violet')} />
              <span className={cn('text-xs sm:text-sm font-bold', selected ? 'text-violet-800' : 'text-slate-600')}>
                {AVATAR_LABELS[id]}
              </span>
              {selected && (
                <span
                  aria-hidden
                  className="absolute -top-1.5 -end-1.5 grid size-7 place-items-center rounded-full bg-brand-violet text-white shadow"
                >
                  <Check className="size-4" strokeWidth={3.5} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-rose-600 font-semibold text-sm sm:text-base">✗ {error}</p>
      )}
    </fieldset>
  );
}
