import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type BadgeColor = 'sky' | 'violet' | 'yellow' | 'green' | 'pink' | 'orange' | 'slate' | 'navy';

export interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  color?: BadgeColor;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const COLORS: Record<BadgeColor, string> = {
  sky: 'bg-sky-100 text-sky-800',
  violet: 'bg-violet-100 text-violet-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  green: 'bg-green-100 text-green-800',
  pink: 'bg-pink-100 text-pink-800',
  orange: 'bg-orange-100 text-orange-800',
  slate: 'bg-slate-100 text-slate-700',
  navy: 'bg-brand-navy text-white',
};
const SIZES = { sm: 'text-xs px-2 py-0.5 gap-1', md: 'text-sm px-3 py-1 gap-1.5', lg: 'text-base px-4 py-1.5 gap-2' };

export function Badge({ color = 'sky', icon, size = 'md', className, children, ...rest }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full font-bold whitespace-nowrap', COLORS[color], SIZES[size], className)} {...rest}>
      {icon && <span className="inline-flex shrink-0" aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
