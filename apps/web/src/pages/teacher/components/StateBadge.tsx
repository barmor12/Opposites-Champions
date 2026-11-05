import { Ban, BarChart3, CheckCircle2, Clock, Hourglass, Pause, Play, SkipForward, Sparkles, Timer, Trophy, type LucideIcon } from 'lucide-react';
import type { GameState } from '@oc/shared';
import { cn } from '@/lib/cn';
import { STATE_LABELS, type BadgeTone } from '../labels';

export const TONE_CLASSES: Record<BadgeTone, string> = {
  gray: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200/80',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/80',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200/80',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200/80',
  navy: 'bg-indigo-50 text-indigo-800 ring-indigo-200/80',
};

const STATE_ICONS: Record<GameState, LucideIcon> = {
  CREATED: Sparkles,
  WAITING_FOR_PLAYERS: Hourglass,
  COUNTDOWN: Timer,
  QUESTION_ACTIVE: Play,
  QUESTION_RESULTS: BarChart3,
  NEXT_QUESTION: SkipForward,
  FINAL_RESULTS: Trophy,
  COMPLETED: CheckCircle2,
  PAUSED: Pause,
  CANCELLED: Ban,
  EXPIRED: Clock,
};

const LIVE_STATES: readonly GameState[] = ['COUNTDOWN', 'QUESTION_ACTIVE', 'QUESTION_RESULTS', 'NEXT_QUESTION'];

export function StateBadge({ state, size = 'sm', className }: { state: GameState; size?: 'sm' | 'md'; className?: string }) {
  const { label, tone } = STATE_LABELS[state];
  const Icon = STATE_ICONS[state];
  const live = LIVE_STATES.includes(state);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset',
        TONE_CLASSES[tone],
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs',
        className,
      )}
      data-state={state}
    >
      {live ? (
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <Icon className={size === 'md' ? 'size-4' : 'size-3.5'} aria-hidden />
      )}
      {label}
    </span>
  );
}

export function TonePill({ tone, children, className = '', icon }: { tone: BadgeTone; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', TONE_CLASSES[tone], className)}>
      {icon && <span className="inline-flex shrink-0" aria-hidden>{icon}</span>}
      {children}
    </span>
  );
}
