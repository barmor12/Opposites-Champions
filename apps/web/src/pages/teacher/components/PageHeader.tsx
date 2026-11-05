import { useEffect, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useTeacherChrome, type Crumb } from './chrome';

export type { Crumb } from './chrome';

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** פירורי לחם – מוצגים בסרגל העליון של ה־Layout */
  crumbs?: Crumb[];
  actions?: ReactNode;
  /** תווית קטנה מעל הכותרת */
  eyebrow?: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const { setCrumbs } = useTeacherChrome();
  const crumbsKey = JSON.stringify(crumbs ?? []);

  useEffect(() => {
    setCrumbs(JSON.parse(crumbsKey) as Crumb[]);
    return () => setCrumbs([]);
  }, [crumbsKey, setCrumbs]);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-700">{eyebrow}</div>}
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-navy sm:text-[2rem] sm:leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}
