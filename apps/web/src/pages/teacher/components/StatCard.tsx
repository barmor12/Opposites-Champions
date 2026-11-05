import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';

const TONES = {
  sky: 'bg-brand-sky/15 text-brand-sky',
  violet: 'bg-brand-violet/15 text-brand-violet',
  green: 'bg-brand-green/15 text-brand-green',
  orange: 'bg-brand-orange/15 text-brand-orange',
  pink: 'bg-brand-pink/15 text-brand-pink',
  yellow: 'bg-brand-yellow/25 text-amber-700',
} as const;

export interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  hint?: string;
  loading?: boolean;
}

export function StatCard({ label, value, icon: Icon, tone = 'violet', hint, loading }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${TONES[tone]}`}>
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <div className="min-w-0">
        <div className="text-sm text-slate-500">{label}</div>
        {loading ? (
          <div className="mt-1 h-7 w-16 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <div className="text-2xl font-bold text-brand-navy tabular-nums">{value}</div>
        )}
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
    </Card>
  );
}
