import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface PanelProps extends Omit<ComponentPropsWithoutRef<'section'>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  /** מספר שלב (לטפסים מדורגים) */
  step?: number;
  padding?: 'none' | 'sm' | 'md';
  children?: ReactNode;
  /** ללא ריפוד פנימי לגוף (לטבלאות) */
  flush?: boolean;
  tone?: 'default' | 'violet' | 'green' | 'navy';
}

const TONE_HEAD: Record<NonNullable<PanelProps['tone']>, string> = {
  default: 'bg-slate-100 text-brand-navy',
  violet: 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_6px_14px_-6px_rgba(139,92,246,.7)]',
  green: 'bg-linear-to-br from-emerald-400 to-green-500 text-white shadow-[0_6px_14px_-6px_rgba(34,197,94,.7)]',
  navy: 'bg-linear-to-br from-slate-700 to-brand-navy text-white shadow-[0_6px_14px_-6px_rgba(30,41,59,.7)]',
};

/** כרטיס זכוכית אחיד לממשק המורה – כותרת, תיאור, אייקון/שלב ופעולות. */
export function Panel({ title, description, icon, actions, step, padding = 'md', flush, tone = 'violet', className, children, ...rest }: PanelProps) {
  const hasHead = title || description || actions;
  const pad = padding === 'none' ? '' : padding === 'sm' ? 'p-4' : 'p-5 sm:p-6';
  return (
    <Card as="section" variant="glass" padding="none" className={cn('relative overflow-hidden ring-1 ring-white/70', className)} {...rest}>
      {hasHead && (
        <header className={cn('flex flex-wrap items-start justify-between gap-3', flush ? 'border-b border-slate-100 px-5 py-4 sm:px-6' : cn(pad, 'pb-0'))}>
          <div className="flex min-w-0 items-start gap-3">
            {(icon || step !== undefined) && (
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl text-sm font-extrabold', TONE_HEAD[tone])} aria-hidden>
                {step !== undefined ? step : icon}
              </span>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-base font-extrabold leading-tight tracking-tight text-brand-navy sm:text-lg">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && pad, hasHead && !flush && 'pt-4')}>{children}</div>
    </Card>
  );
}
