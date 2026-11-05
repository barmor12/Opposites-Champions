// מבוסס על 21st.dev — Magic Button (lucasbassetti) + ThreeDButton (radiumcoders, Evil Buttons, Apache-2.0):
// כפתור "נלחץ" תלת־ממדי: צל סטטי + שפה כהה מאחורי פאה קדמית שמתרוממת ב־hover ונלחצת ב־active, עם ברק מחליק.
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export type MagicButtonTone = 'yellow' | 'violet' | 'green' | 'white';
export type MagicButtonSize = 'md' | 'lg' | 'xl';

export interface MagicButtonProps extends ComponentPropsWithoutRef<'button'> {
  tone?: MagicButtonTone;
  size?: MagicButtonSize;
  /** הילה זוהרת מונפשת מסביב (לפעולה הראשית בעמוד) */
  glow?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const TONES: Record<MagicButtonTone, { face: string; edge: string; glow: string }> = {
  yellow: {
    face: 'bg-linear-to-b from-yellow-300 to-amber-400 text-brand-navy',
    edge: 'bg-linear-to-l from-amber-700 via-amber-600 to-amber-700',
    glow: 'from-amber-300 via-yellow-200 to-orange-300',
  },
  violet: {
    face: 'bg-linear-to-b from-violet-500 to-violet-600 text-white',
    edge: 'bg-linear-to-l from-violet-900 via-violet-800 to-violet-900',
    glow: 'from-violet-400 via-fuchsia-300 to-sky-300',
  },
  green: {
    face: 'bg-linear-to-b from-emerald-400 to-green-600 text-white',
    edge: 'bg-linear-to-l from-green-900 via-green-800 to-green-900',
    glow: 'from-emerald-300 via-lime-200 to-cyan-300',
  },
  white: {
    face: 'bg-linear-to-b from-white to-slate-100 text-brand-navy',
    edge: 'bg-linear-to-l from-slate-400 via-slate-300 to-slate-400',
    glow: 'from-slate-200 via-white to-slate-200',
  },
};

const SIZES: Record<MagicButtonSize, string> = {
  md: 'min-h-12 px-5 text-base gap-2',
  lg: 'min-h-14 px-7 text-lg gap-2.5',
  xl: 'min-h-16 px-9 text-xl gap-3',
};

export const MagicButton = forwardRef<HTMLButtonElement, MagicButtonProps>(function MagicButton(
  { tone = 'yellow', size = 'lg', glow, icon, fullWidth, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const t = TONES[tone];
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cn(
        'group relative isolate inline-block min-h-0 cursor-pointer select-none rounded-2xl border-0 bg-transparent p-0 text-start',
        '[-webkit-tap-highlight-color:transparent] outline-offset-4 focus-visible:outline-4 focus-visible:outline-brand-violet',
        'disabled:pointer-events-none disabled:opacity-60',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {glow && (
        <motion.span
          aria-hidden
          className={cn('absolute -inset-1 -z-10 rounded-[1.25rem] bg-linear-to-r blur-md', t.glow)}
          animate={reduce ? { opacity: 0.55 } : { opacity: [0.35, 0.75, 0.35], scale: [1, 1.03, 1] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {/* צל */}
      <span
        aria-hidden
        className="absolute inset-0 translate-y-[3px] rounded-2xl bg-slate-900/30 blur-[5px] transition-transform duration-500 ease-[cubic-bezier(.3,.7,.4,1)] group-hover:translate-y-[5px] group-hover:duration-200 group-active:translate-y-[1px] group-active:duration-75"
      />
      {/* שפה */}
      <span aria-hidden className={cn('absolute inset-0 rounded-2xl', t.edge)} />
      {/* פאה */}
      <span
        className={cn(
          'relative flex w-full -translate-y-[5px] items-center justify-center overflow-hidden rounded-2xl font-extrabold leading-none',
          'shadow-[inset_0_2px_0_rgba(255,255,255,.55),inset_0_-2px_0_rgba(0,0,0,.08)]',
          'transition-transform duration-500 ease-[cubic-bezier(.3,.7,.4,1)] group-hover:-translate-y-[7px] group-hover:duration-200 group-active:-translate-y-[1px] group-active:duration-75',
          'group-disabled:translate-y-0',
          t.face,
          SIZES[size],
        )}
      >
        {/* ברק */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -start-1/2 w-1/2 -skew-x-12 bg-linear-to-r from-transparent via-white/60 to-transparent opacity-0 transition-[opacity,transform] duration-700 ease-out group-hover:translate-x-[-300%] group-hover:opacity-100 rtl:group-hover:translate-x-[300%]"
        />
        {icon && (
          <span className="relative inline-flex shrink-0" aria-hidden>
            {icon}
          </span>
        )}
        <span className="relative">{children}</span>
      </span>
    </button>
  );
});
