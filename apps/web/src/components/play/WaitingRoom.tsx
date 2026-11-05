import { Users, Hourglass, KeyRound } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { AvatarId, LeaderboardEntry, RoomPublicView } from '@oc/shared';
import { Avatar, Badge, Card, Character, NumberTicker } from '@/components/ui';
import { Leaderboard } from '@/components/Leaderboard';
import { LightRays } from '@/animations';
import type { ConnectionStatus } from '@/stores/playerStore';
import { cn } from '@/lib/cn';

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
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 lg:max-w-2xl">
      <Card variant="glass" className="flex flex-col items-center gap-4 overflow-hidden text-center shadow-float">
        <div className="flex items-center justify-center gap-3 sm:gap-5">
          <Character name="sun" mood="happy" size="sm" delay={0.3} className="hidden sm:block" />
          <div>
            <p className="text-sm font-bold text-slate-500">הכיתה</p>
            <h1 className="text-fluid-title font-black text-brand-navy text-shadow-pop">{room.className}</h1>
          </div>
          <Character name="moon" mood="happy" size="sm" animate="bounce" className="hidden sm:block" />
        </div>

        {/* במה תלת־ממדית */}
        <div className="relative mt-2 flex w-full max-w-sm flex-col items-center">
          <div className="relative grid h-40 w-full place-items-end justify-center sm:h-48">
            <LightRays color="rgb(250 204 21)" intensity={0.3} className="w-[120%]" />
            <motion.div
              className="relative z-10 mb-7 flex flex-col items-center sm:mb-8"
              animate={reduce ? undefined : { y: [0, -16, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Avatar id={avatar} size="xl" ring ringColor="gold" glow />
            </motion.div>
            {/* צל על הבמה */}
            <motion.span
              aria-hidden
              className="absolute bottom-[1.15rem] left-1/2 z-[5] h-4 w-24 -translate-x-1/2 rounded-full bg-amber-900/25 blur-sm sm:bottom-[1.35rem]"
              animate={reduce ? undefined : { scaleX: [1, 0.78, 1], opacity: [0.35, 0.2, 0.35] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* הבמה: פאה עליונה בהירה + צד כהה */}
            <div aria-hidden className="absolute bottom-0 left-1/2 w-60 -translate-x-1/2 sm:w-72">
              <div className="h-6 w-full rounded-[50%] bg-gradient-to-b from-amber-600 to-amber-800 shadow-[0_14px_24px_-8px_rgba(120,53,15,0.5)]" style={{ transform: 'translateY(10px)' }} />
              <div className="absolute inset-x-0 top-0 h-7 rounded-[50%] bg-gradient-to-b from-yellow-200 via-amber-300 to-amber-400 shadow-[inset_0_2px_0_rgba(255,255,255,0.8),inset_0_-3px_6px_rgba(180,83,9,0.35)]" />
              <div className="absolute inset-x-[12%] top-[6px] h-3 rounded-[50%] bg-white/45 blur-[2px]" />
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm font-bold text-slate-500">את/ה</p>
            <p className="text-2xl font-black text-brand-navy sm:text-3xl">{displayName}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge color="sky" size="lg" icon={<Users className="size-5" />}>
            <span aria-live="polite" className="tabular-nums">
              <NumberTicker value={participantCount} />
            </span>{' '}
            שחקנים בחדר
          </Badge>
          <Badge color="slate" size="lg" icon={<KeyRound className="size-5" />}>
            קוד: <span dir="ltr" className="ms-1 tabular-nums tracking-[0.2em]">{room.code}</span>
          </Badge>
        </div>

        <motion.div
          className={cn(
            'mt-1 flex items-center gap-3 rounded-2xl bg-gradient-to-b from-violet-50 to-violet-100/90 px-5 py-3.5 text-lg font-bold text-violet-800 ring-1 ring-violet-200 sm:text-xl',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_16px_-10px_rgba(109,40,217,0.5)]',
          )}
          animate={reduce ? undefined : { scale: [1, 1.025, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          role="status"
        >
          <Hourglass className="size-7 shrink-0 text-brand-violet animate-[spin_3s_linear_infinite]" aria-hidden />
          {afterRound ? 'המורה פתחה סבב חדש! מחכים להתחלה…' : 'מחכים שהמורה תתחיל את המשחק!'}
        </motion.div>
        <WaitingDots />
      </Card>

      {leaderboard && leaderboard.length > 0 && room.settings.showLeaderboard && (
        <Card padding="sm" variant="glass">
          <h2 className="mb-3 text-center text-xl font-black">התוצאות מהסבב הקודם</h2>
          <Leaderboard entries={leaderboard} highlightId={participantId ?? undefined} compact limit={5} />
        </Card>
      )}
    </div>
  );
}

function WaitingDots() {
  const reduce = useReducedMotion();
  const colors = ['from-sky-300 to-sky-500', 'from-violet-300 to-violet-600', 'from-pink-300 to-pink-500', 'from-yellow-200 to-amber-500', 'from-green-300 to-green-600'];
  return (
    <div className="flex gap-2.5" aria-hidden>
      {colors.map((c, i) => (
        <motion.span
          key={c}
          className={`block size-4 rounded-full bg-gradient-to-b ${c} shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_3px_6px_-2px_rgba(30,41,59,0.4)]`}
          animate={reduce ? undefined : { y: [0, -12, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
