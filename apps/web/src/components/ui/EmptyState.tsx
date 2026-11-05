import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LazyImage } from './LazyImage';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  emoji?: string;
  image?: string;
  className?: string;
}

/** מצב ריק ידידותי */
export function EmptyState({ title, description, action, emoji = '🔍', image = '/images/ui/empty-state.svg', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-bubble bg-white/70 px-6 py-10 text-center', className)}>
      <LazyImage
        src={image}
        alt=""
        eager
        skeleton={false}
        wrapperClassName="size-28 sm:size-36"
        className="size-full object-contain"
        fallback={<span className="text-6xl leading-none" aria-hidden>{emoji}</span>}
      />
      <h3 className="text-2xl font-bold">{title}</h3>
      {description && <p className="max-w-md text-slate-600">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
