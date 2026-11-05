import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType;
  variant?: 'solid' | 'glass' | 'outline';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const VARIANTS = {
  solid: 'bg-white shadow-card',
  glass: 'bg-white/85 backdrop-blur-md shadow-card border border-white/70',
  outline: 'bg-white/60 border-2 border-dashed border-sky-200',
};
const PADDING = { none: '', sm: 'p-4', md: 'p-5 sm:p-7', lg: 'p-6 sm:p-10' };

/** כרטיס גדול ומעוגל עם צל רך */
export function Card({ as: Tag = 'div', variant = 'solid', padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <Tag className={cn('rounded-bubble', VARIANTS[variant], PADDING[padding], className)} {...rest}>
      {children}
    </Tag>
  );
}
