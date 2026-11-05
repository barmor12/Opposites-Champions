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
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-violet text-white border-violet-800 hover:bg-violet-500 shadow-pop',
  secondary:
    'bg-white text-brand-navy border-slate-300 hover:bg-slate-50 shadow-card',
  success:
    'bg-brand-green text-white border-green-700 hover:bg-green-500 shadow-card',
  danger:
    'bg-rose-500 text-white border-rose-700 hover:bg-rose-400 shadow-card',
  ghost:
    'bg-transparent text-brand-navy border-transparent hover:bg-white/70 shadow-none',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-12 px-5 text-base gap-2 rounded-2xl',
  lg: 'min-h-14 px-7 text-lg gap-2.5 rounded-2xl',
  xl: 'min-h-16 px-9 text-xl sm:text-2xl gap-3 rounded-3xl',
};

/** כפתור "מלא" לילדים: גדול, מעוגל, עם צל תחתון ואנימציית לחיצה */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'lg', loading = false, fullWidth, icon, iconEnd, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const reduce = useReducedMotion();
  const isDisabled = disabled || loading;
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      whileHover={reduce || isDisabled ? undefined : { scale: 1.03, y: -1 }}
      whileTap={reduce || isDisabled ? undefined : { scale: 0.96, y: 2 }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      className={cn(
        'relative inline-flex items-center justify-center font-bold leading-none border-b-4 transition-colors',
        'disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size="sm" className="text-current" />
      ) : (
        icon && <span className="shrink-0 inline-flex" aria-hidden>{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconEnd && <span className="shrink-0 inline-flex" aria-hidden>{iconEnd}</span>}
    </motion.button>
  );
});
