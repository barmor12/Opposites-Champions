/**
 * רכיבי UI מקומיים וקטנים למודול המשחקים – ללא תלות בערכת ה־UI של המעטפת,
 * כדי לאפשר פיתוח מקבילי. (LazyImage / Button / ScoreBadge / cn)
 * Button adapted from 21st.dev — Pop Button by tom_ui (thick bottom border → active:border-b-2) + Magic Button edge/sheen layers.
 */
import { motion, useReducedMotion } from 'motion/react';
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './utils';

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
  /** מסגרת מבריקה (gloss) סביב התמונה */
  glossy?: boolean;
}

type ImgStatus = 'loading' | 'loaded' | 'error';

export function LazyImage({ src, alt, className, imgClassName, fallback = null, onError, glossy }: LazyImageProps) {
  const [status, setStatus] = useState<ImgStatus>('loading');
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    // איפוס מצב כשהמקור משתנה (adjusting state during render)
    setPrevSrc(src);
    setStatus('loading');
  }

  if (status === 'error') {
    return fallback ? <div className={cn('flex items-center justify-center', className)}>{fallback}</div> : null;
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        glossy && 'rounded-2xl bg-gradient-to-b from-white to-slate-100 shadow-[inset_0_2px_0_rgba(255,255,255,1),inset_0_-3px_6px_rgba(30,41,59,0.08),0_6px_14px_-8px_rgba(30,41,59,0.35)] ring-1 ring-white/80',
        className,
      )}
      data-status={status}
    >
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
      {glossy && <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-0 h-[38%] rounded-full bg-gradient-to-b from-white/70 to-transparent" />}
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
  /** הילה פועמת */
  glow?: boolean;
}

const VARIANT: Record<ButtonVariant, { face: string; deck: string }> = {
  primary: {
    face: 'bg-gradient-to-b from-violet-400 via-violet-500 to-violet-600 text-white',
    deck: 'bg-violet-900 shadow-[0_14px_28px_-10px_rgba(109,40,217,0.6)]',
  },
  secondary: {
    face: 'bg-gradient-to-b from-white to-slate-100 text-slate-800',
    deck: 'bg-slate-300 shadow-[0_12px_24px_-10px_rgba(30,41,59,0.3)]',
  },
  success: {
    face: 'bg-gradient-to-b from-green-400 via-green-500 to-green-600 text-white',
    deck: 'bg-green-800 shadow-[0_14px_28px_-10px_rgba(21,128,61,0.6)]',
  },
  ghost: { face: 'bg-transparent text-slate-600 hover:bg-white/70', deck: 'hidden' },
};

const SIZE = {
  md: 'min-h-12 px-5 text-lg',
  lg: 'min-h-14 px-7 text-xl',
  xl: 'min-h-16 px-9 text-2xl',
};

export function Button({ variant = 'primary', size = 'lg', icon, children, className, type = 'button', glow, ...rest }: ButtonProps) {
  const reduced = useReducedMotion();
  const ghost = variant === 'ghost';
  const v = VARIANT[variant];
  return (
    <motion.button
      type={type}
      whileHover={reduced || rest.disabled || ghost ? undefined : { y: -2 }}
      whileTap={reduced || rest.disabled ? undefined : { y: 3 }}
      transition={{ type: 'spring', stiffness: 600, damping: 30 }}
      className={cn(
        'group relative isolate inline-flex items-center justify-center rounded-2xl font-extrabold tracking-wide outline-none',
        !ghost && 'pb-[6px]',
        'focus-visible:ring-4 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...rest}
    >
      {glow && !ghost && !rest.disabled && (
        <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-20 rounded-[inherit]', variant === 'success' ? 'animate-glow-gold' : 'animate-glow')} />
      )}
      {!ghost && <span aria-hidden="true" className={cn('absolute inset-x-0 bottom-0 top-[6px] -z-10 rounded-[inherit]', v.deck)} />}
      <span
        className={cn(
          'relative z-10 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-[inherit] transition-transform duration-100 group-active:translate-y-[4px]',
          !ghost && 'shadow-[inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-3px_0_rgba(0,0,0,0.12),inset_0_0_0_1px_rgba(255,255,255,0.25)]',
          v.face,
          SIZE[size],
        )}
      >
        {!ghost && <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/35 to-transparent" />}
        {!ghost && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-0 transition-[transform,opacity] duration-500 group-hover:translate-x-[300%] group-hover:opacity-80" />
        )}
        <span className={cn('relative z-10 inline-flex items-center gap-2', !ghost && variant !== 'secondary' && 'drop-shadow-[0_1px_0_rgba(0,0,0,0.2)]')}>
          {children}
          {icon}
        </span>
      </span>
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
        'relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border-b-4 border-amber-600 bg-gradient-to-b from-yellow-200 via-yellow-300 to-amber-400 px-5 py-1.5 text-xl font-black text-amber-950',
        'shadow-[0_12px_24px_-10px_rgba(245,158,11,0.7),inset_0_2px_0_rgba(255,255,255,0.8)] ring-2 ring-white',
        className,
      )}
      data-testid="score-badge"
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/60 to-transparent" />
      <span aria-hidden="true" className="relative drop-shadow">⭐</span>
      <span className="relative">+{points} נְקוּדּוֹת</span>
    </motion.span>
  );
}
