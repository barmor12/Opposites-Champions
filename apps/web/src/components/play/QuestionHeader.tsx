import { Star, Flame } from 'lucide-react';
import type { QuestionView } from '@oc/shared';
import { formatNumber } from '@/lib/format';
import { ProgressBar, Badge } from '@/components/ui';
import { TimerRing } from './TimerRing';

export interface QuestionHeaderProps {
  question: QuestionView;
  score: number;
  streak: number;
  serverOffsetMs: number;
  answered: boolean;
  paused?: boolean;
  onExpire: () => void;
}

/** כותרת שאלה: התקדמות, ניקוד (aria-live) וטיימר */
export function QuestionHeader({ question, score, streak, serverOffsetMs, answered, paused, onExpire }: QuestionHeaderProps) {
  const n = question.index + 1;
  return (
    <header className="flex flex-col gap-3 rounded-bubble bg-white/85 p-3 shadow-card backdrop-blur sm:p-4">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-black sm:text-lg">
              שאלה {n} מתוך {question.total}
            </span>
            {question.isTreasure && (
              <Badge color="yellow" icon={<span aria-hidden>💎</span>}>
                אוצר {question.treasureStep}/{question.treasureTotal ?? 5}
              </Badge>
            )}
          </div>
          <ProgressBar value={n} max={question.total} size="sm" color="rainbow" label={undefined} />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            aria-live="polite"
            aria-atomic
            className="flex min-h-12 items-center gap-1.5 rounded-2xl bg-violet-100 px-3 font-black text-violet-800"
          >
            <Star className="size-5 fill-brand-yellow text-yellow-500" aria-hidden />
            <span className="tabular-nums text-lg sm:text-xl">{formatNumber(score)}</span>
            <span className="sr-only">נקודות</span>
            {streak >= 2 && (
              <span className="ms-1 inline-flex items-center gap-0.5 text-sm text-orange-600" title="רצף תשובות נכונות">
                <Flame className="size-4 fill-orange-400" aria-hidden /> {streak}
              </span>
            )}
          </div>
          <TimerRing
            endsAt={answered ? null : question.endsAt}
            totalMs={question.timeLimitMs}
            serverOffsetMs={serverOffsetMs}
            onExpire={onExpire}
            paused={paused}
            size={64}
          />
        </div>
      </div>
    </header>
  );
}
