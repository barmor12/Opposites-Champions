/**
 * רכיבי UI מקומיים וקטנים למודול המשחקים – ללא תלות בערכת ה־UI של המעטפת,
 * כדי לאפשר פיתוח מקבילי. (LazyImage / Button / cn)
 */
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

// ---------- LazyImage ----------
export interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  /** מה להציג אם התמונה נכשלה בטעינה (ברירת מחדל: כלום – התמונה מוסתרת) */
  fallback?: ReactNode;
  /** נקרא כשהתמונה נכשלת */
  onError?: () => void;
}

type ImgStatus = 'loading' | 'loaded' | 'error';

export function LazyImage({ src, alt, className, imgClassName, fallback = null, onError }: LazyImageProps) {
  const [status, setStatus] = useState<ImgStatus>('loading');

  useEffect(() => {
    setStatus('loading');
  }, [src]);

  if (status === 'error') {
    return fallback ? <div className={cn('flex items-center justify-center', className)}>{fallback}</div> : null;
  }

  return (
    <div className={cn('relative overflow-hidden', className)} data-status={status}>
      {status === 'loading' && (
        <div
          aria-hidden="true"
          data-testid="image-skeleton"
          className="absolute inset-0 animate-pulse rounded-2xl bg-slate-200/80"
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setStatus('loaded')}
        onError={() => {
          setStatus('error');
          onError?.();
        }}
        className={cn(
          'h-full w-full object-contain transition-opacity duration-300',
          status === 'loaded' ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  );
}

// ---------- Button ----------
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  children: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-violet-500 to-violet-700 text-white shadow-[0_6px_0_0_#4c1d95] hover:from-violet-400 hover:to-violet-600 active:translate-y-1 active:shadow-[0_2px_0_0_#4c1d95]',
  secondary:
    'bg-white text-slate-800 border-2 border-slate-300 shadow-[0_4px_0_0_#cbd5e1] hover:bg-slate-50 active:translate-y-1 active:shadow-none',
  success:
    'bg-gradient-to-b from-green-400 to-green-600 text-white shadow-[0_6px_0_0_#15803d] hover:from-green-300 hover:to-green-500 active:translate-y-1 active:shadow-[0_2px_0_0_#15803d]',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
};

const SIZE = {
  md: 'min-h-12 px-5 text-lg',
  lg: 'min-h-14 px-7 text-xl',
  xl: 'min-h-16 px-9 text-2xl',
};

export function Button({ variant = 'primary', size = 'lg', icon, children, className, type = 'button', ...rest }: ButtonProps) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type={type}
      whileTap={reduced || rest.disabled ? undefined : { scale: 0.96 }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold tracking-wide transition-colors',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {children}
      {icon}
    </motion.button>
  );
}

// ---------- Score badge ----------
export function ScoreBadge({ points, className }: { points: number; className?: string }) {
  return (
    <motion.span
      initial={{ scale: 0.4, rotate: -8, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 14 }}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-yellow-300 px-4 py-1.5 text-xl font-black text-yellow-900 shadow-md ring-4 ring-yellow-100',
        className,
      )}
      data-testid="score-badge"
    >
      <span aria-hidden="true">⭐</span>
      <span>+{points} נקודות</span>
    </motion.span>
  );
}
