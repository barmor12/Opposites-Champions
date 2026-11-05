import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/cn';
import { CountUp } from './CountUp';
import { SpotlightOverlay } from './Spotlight';
import { spotlightHandlers } from './spotlight';

const TONES = {
  sky: { circle: 'from-sky-400 to-cyan-500 shadow-sky-500/40', spark: '#38bdf8', ring: 'ring-sky-100' },
  violet: { circle: 'from-violet-500 to-fuchsia-500 shadow-violet-500/40', spark: '#8b5cf6', ring: 'ring-violet-100' },
  green: { circle: 'from-emerald-400 to-green-500 shadow-emerald-500/40', spark: '#22c55e', ring: 'ring-emerald-100' },
  orange: { circle: 'from-orange-400 to-amber-500 shadow-orange-500/40', spark: '#fb923c', ring: 'ring-orange-100' },
  pink: { circle: 'from-pink-400 to-rose-500 shadow-pink-500/40', spark: '#f472b6', ring: 'ring-pink-100' },
  yellow: { circle: 'from-yellow-300 to-amber-400 shadow-amber-400/40', spark: '#f59e0b', ring: 'ring-amber-100' },
} as const;

export type StatTone = keyof typeof TONES;

export interface StatCardProps {
  label: string;
  /** ערך מספרי – מונפש בספירה. null/undefined = אין נתון. */
  value: number | null | undefined;
  format?: (n: number) => string;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
  loading?: boolean;
  /** השהיית כניסה (שניות) – ל־stagger של רשת כרטיסים */
  delay?: number;
}

/** עקומה דקורטיבית (ללא נתונים) – מרמזת על "מגמה" בפינת הכרטיס. */
function SparkAccent({ color }: { color: string }) {
  // useId – כמה כרטיסים באותו גוון לא יחלקו מזהה gradient כפול
  const id = `spark-${useId()}`;
  return (
    <svg aria-hidden viewBox="0 0 140 48" className="pointer-events-none absolute bottom-0 start-0 h-12 w-36 opacity-80" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 36 C 18 34, 26 18, 42 22 S 66 40, 84 26 S 112 6, 140 14 L140 48 L0 48 Z" fill={`url(#${id})`} />
      <path d="M0 36 C 18 34, 26 18, 42 22 S 66 40, 84 26 S 112 6, 140 14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

export function StatCard({ label, value, format, icon: Icon, tone = 'violet', hint, loading, delay = 0 }: StatCardProps) {
  const reduce = useReducedMotion();
  const t = TONES[tone];
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay }}
      whileHover={reduce ? undefined : { y: -3 }}
      className="h-full"
    >
      <Card variant="glass" padding="none" className={cn('group relative h-full overflow-hidden p-4 ring-1 sm:p-5', t.ring)} {...spotlightHandlers()}>
        <SpotlightOverlay color={`${t.spark}2e`} />
        <div className="relative z-10 flex items-start gap-3 sm:gap-4">
          <div
            className={cn(
              'relative grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br text-white shadow-lg sm:size-12',
              'before:absolute before:inset-x-1.5 before:top-1 before:h-3 before:rounded-full before:bg-white/35 before:blur-[2px]',
              t.circle,
            )}
          >
            <Icon className="relative size-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold leading-tight tracking-wide text-slate-600 sm:text-xs">{label}</div>
            {loading ? (
              <div className="mt-1.5 h-8 w-20 animate-pulse rounded-lg bg-slate-200/70" />
            ) : (
              <div className="mt-0.5 text-2xl font-extrabold leading-tight tracking-tight text-brand-navy tabular-nums sm:text-3xl">
                <CountUp value={value} format={format} />
              </div>
            )}
            {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
          </div>
        </div>
        <SparkAccent color={t.spark} />
      </Card>
    </motion.div>
  );
}
