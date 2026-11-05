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

/** רשת 16 דמויות לבחירה – אריחים תלת־ממדיים (pop-button) עם טבעת זוהרת סביב הנבחרת */
export function AvatarPicker({ value, onChange, label = 'בַּחֲרוּ דְּמוּת', error, className }: AvatarPickerProps) {
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
              whileHover={reduce ? undefined : { y: -3 }}
              whileTap={reduce ? undefined : { y: 2, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 500, damping: 24 }}
              className={cn(
                'group relative flex min-h-14 flex-col items-center gap-1 rounded-2xl border-b-[5px] px-1 py-2 sm:py-3 transition-[background-color,border-color,box-shadow] duration-200',
                'active:border-b-[2px] active:translate-y-[3px]',
                selected
                  ? 'border-violet-800 bg-gradient-to-b from-violet-400 to-violet-600 text-white shadow-[0_14px_28px_-10px_rgba(109,40,217,0.65)]'
                  : 'border-slate-300/90 bg-gradient-to-b from-white to-slate-50 text-slate-600 shadow-[0_8px_18px_-10px_rgba(30,41,59,0.35)] hover:from-white hover:to-sky-50 hover:border-sky-300',
              )}
            >
              <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 h-1/3 rounded-full bg-gradient-to-b from-white/60 to-transparent" />
              <Avatar id={id} size="md" ring ringColor={selected ? 'gold' : 'white'} />
              <span className={cn('text-xs sm:text-sm font-bold', selected ? 'text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.25)]' : 'text-slate-600')}>
                {AVATAR_LABELS[id]}
              </span>
              {selected && (
                <motion.span
                  aria-hidden
                  initial={reduce ? false : { scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className="absolute -top-2 -end-2 grid size-7 place-items-center rounded-full bg-gradient-to-b from-green-400 to-green-600 text-white shadow-[0_4px_10px_-2px_rgba(21,128,61,0.6),inset_0_1px_0_rgba(255,255,255,0.5)] ring-2 ring-white"
                >
                  <Check className="size-4" strokeWidth={3.5} />
                </motion.span>
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
