import { Star, Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { QuestionView } from '@oc/shared';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ProgressBar, Badge, NumberTicker } from '@/components/ui';
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

/** HUD של השאלה: התקדמות מבריקה, ניקוד מתגלגל (aria-live), רצף להבה וטיימר זוהר */
export function QuestionHeader({ question, score, streak, serverOffsetMs, answered, paused, onExpire }: QuestionHeaderProps) {
  const reduce = useReducedMotion();
  const n = question.index + 1;
  const hot = streak >= 2;
  return (
    <header className="relative flex flex-col gap-3 rounded-bubble glass px-3 py-3 ring-1 ring-white/70 sm:px-5 sm:py-4">
      <div className="flex items-center gap-2.5 sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="whitespace-nowrap text-base font-black text-brand-navy sm:text-lg">
            שאלה {n} <span className="font-bold text-slate-500">מתוך {question.total}</span>
          </span>
          {question.isTreasure && (
            <Badge color="yellow" icon={<span aria-hidden>💎</span>}>
              אוצר {question.treasureStep}/{question.treasureTotal ?? 5}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* גלולת ניקוד מבריקה */}
          <div
            aria-live="polite"
            aria-atomic
            className={cn(
              'relative flex min-h-12 items-center gap-1.5 overflow-hidden rounded-2xl bg-gradient-to-b from-violet-400 via-violet-500 to-violet-700 px-3 font-black text-white',
              'shadow-[0_10px_22px_-8px_rgba(109,40,217,0.7),inset_0_2px_0_rgba(255,255,255,0.5),inset_0_-3px_0_rgba(0,0,0,0.18)] ring-1 ring-violet-800/40',
            )}
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-1 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/35 to-transparent" />
            <motion.span
              key={score}
              initial={reduce ? false : { scale: 1 }}
              animate={reduce ? undefined : { scale: [1, 1.25, 1], rotate: [0, -12, 0] }}
              transition={{ duration: 0.5 }}
              className="relative inline-flex"
            >
              <Star className="size-5 fill-brand-yellow text-yellow-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]" aria-hidden />
            </motion.span>
            <NumberTicker value={score} className="relative tabular-nums text-lg text-shadow-soft sm:text-xl" />
            <span className="sr-only">נקודות: {formatNumber(score)}</span>
            {hot && (
              <motion.span
                initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                className="relative ms-1 inline-flex items-center gap-0.5 rounded-full bg-gradient-to-b from-orange-300 to-orange-500 px-1.5 py-0.5 text-xs text-orange-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] sm:text-sm"
                title="רצף תשובות נכונות"
              >
                <motion.span
                  animate={reduce ? undefined : { scale: [1, 1.2, 0.95, 1.15, 1], rotate: [0, -8, 6, -4, 0] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="inline-flex"
                >
                  <Flame className="size-4 fill-yellow-300 text-orange-700" aria-hidden />
                </motion.span>
                <span dir="ltr">{streak}</span>
                <span className="sr-only">ברצף</span>
              </motion.span>
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
      <ProgressBar value={n} max={question.total} size="sm" color="rainbow" label={undefined} />
    </header>
  );
}
