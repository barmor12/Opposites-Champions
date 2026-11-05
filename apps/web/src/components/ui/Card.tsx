// Spotlight behaviour adapted from 21st.dev — Spotlight Card by preetsuthar17 (radial glow following the pointer).
import { useRef, type ComponentPropsWithoutRef, type ElementType, type PointerEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType;
  variant?: 'solid' | 'glass' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
  /** זרקור עדין שעוקב אחרי הסמן (מחשב בלבד) */
  spotlight?: boolean;
  /** צבע הזרקור */
  spotlightColor?: string;
}

const VARIANTS = {
  solid: 'surface-clay ring-1 ring-white/70',
  glass: 'glass ring-1 ring-white/70',
  outline: 'bg-white/60 border-2 border-dashed border-sky-200',
};
const PADDING = { none: '', sm: 'p-4', md: 'p-5 sm:p-7', lg: 'p-6 sm:p-10' };

/** כרטיס גדול ומעוגל – זכוכית / חימר עם הבלטה עליונה וצל כפול */
export function Card({ as: Tag = 'div', variant = 'solid', padding = 'md', className, children, spotlight, spotlightColor = 'rgb(139 92 246 / 0.16)', onPointerMove, onPointerLeave, style, ...rest }: CardProps) {
  const ref = useRef<HTMLElement | null>(null);
  const frame = useRef<number | null>(null);

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(e);
    if (!spotlight || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${clientX - r.left}px`);
      el.style.setProperty('--spot-y', `${clientY - r.top}px`);
      el.style.setProperty('--spot-o', '1');
    });
  };
  const handleLeave = (e: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(e);
    ref.current?.style.setProperty('--spot-o', '0');
  };

  return (
    <Tag
      ref={ref}
      className={cn('relative rounded-bubble', spotlight && 'overflow-hidden', VARIANTS[variant], PADDING[padding], className)}
      onPointerMove={spotlight ? handleMove : onPointerMove}
      onPointerLeave={spotlight ? handleLeave : onPointerLeave}
      style={style}
      {...rest}
    >
      {spotlight && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-500"
          style={{
            opacity: 'var(--spot-o, 0)' as unknown as number,
            background: `radial-gradient(420px circle at var(--spot-x, 50%) var(--spot-y, 50%), ${spotlightColor}, transparent 70%)`,
          }}
        />
      )}
      {children}
    </Tag>
  );
}
