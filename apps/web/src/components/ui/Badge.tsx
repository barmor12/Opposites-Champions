import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeColor = 'sky' | 'violet' | 'yellow' | 'green' | 'pink' | 'orange' | 'slate' | 'navy';

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  color?: BadgeColor;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** מראה "מלא" ובולט (גרדיאנט רווי) */
  solid?: boolean;
}

const COLORS: Record<BadgeColor, { soft: string; solid: string }> = {
  sky: { soft: 'from-sky-100 to-sky-200/80 text-sky-800 ring-sky-300/60', solid: 'from-sky-400 to-sky-600 text-white ring-sky-700/40' },
  violet: { soft: 'from-violet-100 to-violet-200/80 text-violet-800 ring-violet-300/60', solid: 'from-violet-400 to-violet-600 text-white ring-violet-800/40' },
  yellow: { soft: 'from-yellow-100 to-amber-200/80 text-amber-900 ring-amber-300/70', solid: 'from-yellow-300 to-amber-500 text-amber-950 ring-amber-700/40' },
  green: { soft: 'from-green-100 to-emerald-200/80 text-green-800 ring-green-300/60', solid: 'from-green-400 to-emerald-600 text-white ring-green-800/40' },
  pink: { soft: 'from-pink-100 to-pink-200/80 text-pink-800 ring-pink-300/60', solid: 'from-pink-400 to-pink-600 text-white ring-pink-800/40' },
  orange: { soft: 'from-orange-100 to-orange-200/80 text-orange-800 ring-orange-300/60', solid: 'from-orange-400 to-orange-600 text-white ring-orange-800/40' },
  slate: { soft: 'from-slate-100 to-slate-200/80 text-slate-700 ring-slate-300/60', solid: 'from-slate-500 to-slate-700 text-white ring-slate-900/40' },
  navy: { soft: 'from-slate-700 to-brand-navy text-white ring-slate-900/50', solid: 'from-slate-700 to-brand-navy text-white ring-slate-900/50' },
};
const SIZES = { sm: 'text-xs px-2.5 py-0.5 gap-1 min-h-6', md: 'text-sm px-3 py-1 gap-1.5 min-h-7', lg: 'text-base px-4 py-1.5 gap-2 min-h-9' };

/** תגית קטנה עם נפח: גרדיאנט, הבלטה עליונה וטבעת עדינה */
export function Badge({ color = 'sky', icon, size = 'md', solid, className, children, ...rest }: BadgeProps) {
  const c = COLORS[color];
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full bg-gradient-to-b font-bold ring-1 ring-inset',
        'shadow-[0_2px_6px_-2px_rgba(30,41,59,0.25),inset_0_1px_0_rgba(255,255,255,0.6)]',
        solid ? c.solid : c.soft,
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon && <span className="inline-flex shrink-0" aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
