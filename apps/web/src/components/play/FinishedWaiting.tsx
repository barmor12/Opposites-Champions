import { motion, useReducedMotion } from 'motion/react';
import { PartyPopper, Users } from 'lucide-react';
import type { LeaderboardEntry } from '@oc/shared';
import { Card, Character, Badge } from '@/components/ui';
import { Leaderboard } from '@/components/Leaderboard';
import { formatNumber } from '@/lib/format';

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
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Card variant="glass" className="flex flex-col items-center gap-4 text-center">
        <Character name="sun" mood="cheer" size="md" animate="bounce" />
        <motion.h1
          initial={reduce ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className="flex items-center gap-2 text-3xl font-black sm:text-4xl"
        >
          <PartyPopper className="size-9 text-brand-orange" aria-hidden /> סיימת!
        </motion.h1>
        <p className="text-xl font-bold text-violet-800">כל הכבוד! מחכים לשאר הכיתה…</p>
        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
          <Stat label="נקודות" value={formatNumber(score)} color="bg-violet-100 text-violet-800" />
          <Stat label="נכונות" value={`${correctAnswers}/${answeredCount}`} color="bg-green-100 text-green-800" />
          <Stat label="דיוק" value={`${answeredCount ? Math.round((correctAnswers / answeredCount) * 100) : 0}%`} color="bg-sky-100 text-sky-800" />
        </div>
        <Badge color="slate" size="lg" icon={<Users className="size-5" />} role="status">
          סיימו {finishedCount} מתוך {participantCount}
        </Badge>
      </Card>
      {showLeaderboard && leaderboard.length > 0 && (
        <Card padding="sm">
          <h2 className="mb-3 text-center text-xl font-black">הדירוג בינתיים</h2>
          <Leaderboard entries={leaderboard} highlightId={participantId ?? undefined} compact limit={8} />
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl px-2 py-3 ${color}`}>
      <span className="text-2xl font-black tabular-nums sm:text-3xl" dir="ltr">{value}</span>
      <span className="text-sm font-bold opacity-80">{label}</span>
    </div>
  );
}
