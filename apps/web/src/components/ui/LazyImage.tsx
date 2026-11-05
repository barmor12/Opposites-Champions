import { useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface LazyImageProps extends Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt' | 'loading'> {
  src: string;
  alt: string;
  /** תוכן חלופי כשהתמונה חסרה/נכשלה (ברירת מחדל: ריבוע עדין) */
  fallback?: ReactNode;
  /** מחלקות לעטיפה */
  wrapperClassName?: string;
  eager?: boolean;
  skeleton?: boolean;
}

/** תמונה בטעינה עצלה עם שלד (skeleton) וגיבוי חינני אם הקובץ חסר */
export function LazyImage({ src, alt, fallback, wrapperClassName, className, eager, skeleton = true, ...rest }: LazyImageProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    // מקור חדש – מאפסים מצב (דפוס "derived state" מומלץ של React)
    setPrevSrc(src);
    setStatus('loading');
  }

  if (status === 'error') {
    return (
      <span
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={cn('inline-flex items-center justify-center overflow-hidden', wrapperClassName)}
      >
        {fallback ?? <span className="block size-full rounded-2xl bg-slate-100" />}
      </span>
    );
  }

  return (
    <span className={cn('relative inline-block overflow-hidden', wrapperClassName)}>
      {skeleton && status === 'loading' && (
        <span aria-hidden className="absolute inset-0 animate-pulse rounded-2xl bg-slate-200/70" />
      )}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={cn('block transition-opacity duration-300', status === 'loaded' ? 'opacity-100' : 'opacity-0', className)}
        {...rest}
      />
    </span>
  );
}
