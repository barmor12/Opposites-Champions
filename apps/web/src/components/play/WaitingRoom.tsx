import { Users, Hourglass } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { AvatarId, LeaderboardEntry, RoomPublicView } from '@oc/shared';
import { Avatar, Badge, Card, Character } from '@/components/ui';
import { Leaderboard } from '@/components/Leaderboard';
import type { ConnectionStatus } from '@/stores/playerStore';

export interface WaitingRoomProps {
  room: RoomPublicView;
  displayName: string;
  avatar: AvatarId;
  participantCount: number;
  connection?: ConnectionStatus;
  leaderboard?: LeaderboardEntry[];
  participantId?: string | null;
  /** אחרי סבב – "המורה פתחה סבב חדש" */
  afterRound?: boolean;
}

export function WaitingRoom({ room, displayName, avatar, participantCount, leaderboard, participantId, afterRound }: WaitingRoomProps) {
  const reduce = useReducedMotion();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <Card variant="glass" className="flex flex-col items-center gap-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <Character name="sun" mood="happy" size="sm" delay={0.3} />
          <div>
            <p className="text-sm font-bold text-slate-500">הכיתה</p>
            <h1 className="text-2xl font-black sm:text-3xl">{room.className}</h1>
          </div>
          <Character name="moon" mood="happy" size="sm" animate="bounce" />
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-black/5">
          <Avatar id={avatar} size="lg" ring />
          <div className="text-start">
            <p className="text-sm font-bold text-slate-500">את/ה</p>
            <p className="text-2xl font-black">{displayName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge color="sky" size="lg" icon={<Users className="size-5" />}>
            <span aria-live="polite">{participantCount}</span> שחקנים בחדר
          </Badge>
          <Badge color="slate" size="lg">
            קוד: <span dir="ltr" className="ms-1 tabular-nums tracking-widest">{room.code}</span>
          </Badge>
        </div>

        <motion.div
          className="mt-2 flex items-center gap-3 rounded-2xl bg-violet-50 px-5 py-4 text-lg font-bold text-violet-800 sm:text-xl"
          animate={reduce ? undefined : { scale: [1, 1.03, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          role="status"
        >
          <Hourglass className="size-7 shrink-0 animate-[spin_3s_linear_infinite]" aria-hidden />
          {afterRound ? 'המורה פתחה סבב חדש! מחכים להתחלה…' : 'מחכים שהמורה תתחיל את המשחק!'}
        </motion.div>
        <WaitingDots />
      </Card>

      {leaderboard && leaderboard.length > 0 && room.settings.showLeaderboard && (
        <Card padding="sm">
          <h2 className="mb-3 text-center text-xl font-black">התוצאות מהסבב הקודם</h2>
          <Leaderboard entries={leaderboard} highlightId={participantId ?? undefined} compact limit={5} />
        </Card>
      )}
    </div>
  );
}

function WaitingDots() {
  const reduce = useReducedMotion();
  const colors = ['bg-brand-sky', 'bg-brand-violet', 'bg-brand-pink', 'bg-brand-yellow', 'bg-brand-green'];
  return (
    <div className="flex gap-2" aria-hidden>
      {colors.map((c, i) => (
        <motion.span
          key={c}
          className={`block size-4 rounded-full ${c}`}
          animate={reduce ? undefined : { y: [0, -12, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
