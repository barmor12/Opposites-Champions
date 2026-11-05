// 3D button adapted from 21st.dev — ThreeDButton by radiumcoders (Evil Buttons, Apache-2.0): deck + face + sheen + press spot,
// and Magic Button by lucasbassetti (edge/shadow layers, optional rainbow edge).
import { forwardRef, type ReactNode } from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
export type ButtonSize = 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  children?: ReactNode;
  /** הילה פועמת (ל־CTA ראשי) */
  glow?: boolean;
  /** קצה צבעוני בקשת (rainbow) */
  rainbow?: boolean;
}

interface VariantStyle {
  face: string;
  deck: string;
  shadow: string;
  spot: string;
}

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: {
    face: 'bg-gradient-to-b from-violet-500 via-violet-600 to-violet-700 text-white',
    deck: 'bg-violet-900',
    shadow: 'shadow-[0_14px_28px_-10px_rgba(109,40,217,0.6)]',
    spot: 'bg-violet-950/25',
  },
  secondary: {
    face: 'bg-gradient-to-b from-white to-slate-100 text-brand-navy',
    deck: 'bg-slate-300',
    shadow: 'shadow-[0_12px_24px_-10px_rgba(30,41,59,0.3)]',
    spot: 'bg-slate-500/15',
  },
  success: {
    face: 'bg-gradient-to-b from-green-500 via-green-600 to-green-700 text-white',
    deck: 'bg-green-800',
    shadow: 'shadow-[0_14px_28px_-10px_rgba(21,128,61,0.6)]',
    spot: 'bg-green-950/25',
  },
  danger: {
    face: 'bg-gradient-to-b from-rose-500 via-rose-600 to-rose-700 text-white',
    deck: 'bg-rose-800',
    shadow: 'shadow-[0_14px_28px_-10px_rgba(190,18,60,0.55)]',
    spot: 'bg-rose-950/25',
  },
  ghost: {
    face: 'bg-transparent text-brand-navy hover:bg-white/75',
    deck: 'hidden',
    shadow: '',
    spot: 'bg-slate-500/10',
  },
};

const SIZES: Record<ButtonSize, { btn: string; face: string; gap: string }> = {
  md: { btn: 'rounded-2xl text-base', face: 'min-h-12 px-5', gap: 'gap-2' },
  lg: { btn: 'rounded-2xl text-lg', face: 'min-h-14 px-7', gap: 'gap-2.5' },
  xl: { btn: 'rounded-3xl text-xl sm:text-2xl', face: 'min-h-16 px-8 sm:px-10', gap: 'gap-3' },
};

const DECK = 6; // px – עובי "הסיפון" (bevel)
const press = { type: 'spring', stiffness: 620, damping: 32, mass: 0.5 } as const;

/** כפתור תלת־ממדי לילדים: סיפון כהה + פאה בגרדיאנט + ברק נע + שקיעה בלחיצה */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'lg', loading = false, fullWidth, icon, iconEnd, className, children, disabled, type = 'button', glow, rainbow, ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const isDisabled = disabled || loading;
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const ghost = variant === 'ghost';
  const interactive = !reduce && !isDisabled;

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      initial="rest"
      animate="rest"
      whileHover={interactive ? 'hover' : undefined}
      whileTap={interactive ? 'tap' : undefined}
      className={cn(
        'group relative isolate inline-flex cursor-pointer select-none font-bold leading-none outline-none [-webkit-tap-highlight-color:transparent]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        !ghost && 'pb-[6px]',
        s.btn,
        fullWidth && 'w-full',
        className,
      )}
      style={{ minHeight: 0 }}
      {...rest}
    >
      {/* הִילָּה פּוֹעֶמֶת */}
      {glow && !ghost && !isDisabled && (
        <span aria-hidden className={cn('pointer-events-none absolute inset-0 -z-20 rounded-[inherit]', variant === 'success' ? 'animate-glow-gold' : 'animate-glow')} />
      )}

      {/* סִיפּוּן (deck) – הַשִּׁכְבָה הַתַּחְתּוֹנָה */}
      {!ghost && (
        <motion.span
          aria-hidden
          variants={{ rest: { y: 0 }, hover: { y: 1 }, tap: { y: -1 } }}
          transition={press}
          className={cn(
            'absolute inset-x-0 bottom-0 -z-10 rounded-[inherit] group-disabled:opacity-40',
            rainbow ? 'rainbow-fill animate-magic-rainbow' : v.deck,
            v.shadow,
          )}
          style={{ top: DECK }}
        />
      )}

      {/* פֵּאָה (face) – הַשִּׁכְבָה הָעֶלְיוֹנָה */}
      <motion.span
        variants={{ rest: { y: 0 }, hover: { y: -2 }, tap: { y: DECK - 1 } }}
        transition={press}
        className={cn(
          'relative z-10 inline-flex w-full items-center justify-center overflow-hidden rounded-[inherit] backface-hidden will-change-transform',
          !ghost && 'shadow-[inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-3px_0_rgba(0,0,0,0.12),inset_0_0_0_1px_rgba(255,255,255,0.25)]',
          'group-disabled:translate-y-0',
          v.face,
          s.face,
        )}
      >
        {/* נְקוּדַּת לְחִיצָה */}
        {!ghost && (
          <motion.span
            aria-hidden
            variants={{ rest: { opacity: 0, scaleX: 0.25 }, hover: { opacity: 0.35, scaleX: 0.5 }, tap: { opacity: 1, scaleX: 1 } }}
            transition={press}
            className={cn('pointer-events-none absolute inset-y-1 left-1/2 w-1/2 -translate-x-1/2 rounded-full blur-md', v.spot)}
          />
        )}
        {/* בָּרָק */}
        {!ghost && (
          <motion.span
            aria-hidden
            variants={{ rest: { opacity: 0, x: '-120%' }, hover: { opacity: 0.7, x: '-30%' }, tap: { opacity: 0.9, x: '90%' } }}
            transition={press}
            className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent"
          />
        )}
        {/* גְּלוֹס עֶלְיוֹן קָבוּעַ */}
        {!ghost && <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/35 to-transparent" />}

        <motion.span variants={{ rest: { y: 0 }, hover: { y: -1 }, tap: { y: 1 } }} transition={press} className={cn('relative z-10 inline-flex items-center justify-center', s.gap)}>
          {loading ? (
            <Spinner size="sm" className="text-current" />
          ) : (
            icon && <span className="inline-flex shrink-0 drop-shadow-sm" aria-hidden>{icon}</span>
          )}
          {children && <span className={cn(!ghost && variant !== 'secondary' && 'drop-shadow-[0_1px_0_rgba(0,0,0,0.2)]')}>{children}</span>}
          {!loading && iconEnd && <span className="inline-flex shrink-0 drop-shadow-sm" aria-hidden>{iconEnd}</span>}
        </motion.span>
      </motion.span>
    </motion.button>
  );
});
