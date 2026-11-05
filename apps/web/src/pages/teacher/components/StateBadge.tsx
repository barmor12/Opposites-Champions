import type { GameState } from '@oc/shared';
import { STATE_LABELS, type BadgeTone } from '../labels';

const TONE_CLASSES: Record<BadgeTone, string> = {
  gray: 'bg-slate-100 text-slate-600 ring-slate-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  navy: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
};

const LIVE_STATES: readonly GameState[] = ['COUNTDOWN', 'QUESTION_ACTIVE', 'QUESTION_RESULTS', 'NEXT_QUESTION'];

export function StateBadge({ state, size = 'sm' }: { state: GameState; size?: 'sm' | 'md' }) {
  const { label, tone } = STATE_LABELS[state];
  const live = LIVE_STATES.includes(state);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${TONE_CLASSES[tone]} ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'
      }`}
      data-state={state}
    >
      {live && <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>}
      {label}
    </span>
  );
}

export function TonePill({ tone, children, className = '' }: { tone: BadgeTone; children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[tone]} ${className}`}>
      {children}
    </span>
  );
}
