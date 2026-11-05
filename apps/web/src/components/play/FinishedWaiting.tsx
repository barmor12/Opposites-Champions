import { motion, useReducedMotion } from 'motion/react';
import { PartyPopper, Users } from 'lucide-react';
import type { LeaderboardEntry } from '@oc/shared';
import { Card, Character, Badge, NumberTicker } from '@/components/ui';
import { Leaderboard } from '@/components/Leaderboard';
import { LightRays } from '@/animations';
import { cn } from '@/lib/cn';

export interface FinishedWaitingProps {
  score: number;
  correctAnswers: number;
  answeredCount: number;
  finishedCount: number;
  participantCount: number;
  showLeaderboard: boolean;
  leaderboard: LeaderboardEntry[];
  participantId: string | null;
}

export function FinishedWaiting({ score, correctAnswers, answeredCount, finishedCount, participantCount, showLeaderboard, leaderboard, participantId }: FinishedWaitingProps) {
  const reduce = useReducedMotion();
  const accuracy = answeredCount ? Math.round((correctAnswers / answeredCount) * 100) : 0;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 lg:max-w-2xl">
      <Card variant="glass" className="relative flex flex-col items-center gap-4 overflow-hidden text-center shadow-float">
        <div className="relative">
          <LightRays color="rgb(250 204 21)" intensity={0.4} className="w-[260%]" />
          <Character name="sun" mood="cheer" size="md" animate="bounce" className="relative" />
        </div>
        <motion.h1
          initial={reduce ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="flex items-center gap-2 text-fluid-hero font-black text-gradient-sun"
        >
          <PartyPopper className="size-9 text-brand-orange sm:size-11" aria-hidden /> סיימת!
        </motion.h1>
        <p className="text-xl font-bold text-violet-800">כל הכבוד! מחכים לשאר הכיתה…</p>
        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
          <Stat label="נקודות" color="from-violet-400 to-violet-700 border-violet-900 text-white" delay={0.1}>
            <NumberTicker value={score} fromZero transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />
          </Stat>
          <Stat label="נכונות" color="from-green-400 to-green-700 border-green-900 text-white" delay={0.2}>
            <span dir="ltr">
              {correctAnswers}/{answeredCount}
            </span>
          </Stat>
          <Stat label="דיוק" color="from-sky-300 to-sky-600 border-sky-800 text-white" delay={0.3}>
            <span dir="ltr">
              <NumberTicker value={accuracy} fromZero transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} />%
            </span>
          </Stat>
        </div>
        <Badge color="slate" size="lg" icon={<Users className="size-5" />} role="status">
          סיימו {finishedCount} מתוך {participantCount}
        </Badge>
      </Card>
      {showLeaderboard && leaderboard.length > 0 && (
        <Card padding="sm" variant="glass">
          <h2 className="mb-3 text-center text-xl font-black">הדירוג בינתיים</h2>
          <Leaderboard entries={leaderboard} highlightId={participantId ?? undefined} compact limit={8} />
        </Card>
      )}
    </div>
  );
}

function Stat({ label, color, delay, children }: { label: string; color: string; delay: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 16, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20, delay }}
      className={cn(
        'relative flex flex-col items-center overflow-hidden rounded-2xl border-b-[6px] bg-gradient-to-b px-2 py-3 sm:py-4',
        'shadow-[0_12px_24px_-10px_rgba(30,41,59,0.45),inset_0_2px_0_rgba(255,255,255,0.45)]',
        color,
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/30 to-transparent" />
      <span className="relative text-2xl font-black tabular-nums text-shadow-soft sm:text-3xl">{children}</span>
      <span className="relative text-sm font-bold opacity-90">{label}</span>
    </motion.div>
  );
}
