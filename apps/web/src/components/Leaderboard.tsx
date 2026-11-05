// Podium ordering/a11y pattern adapted from 21st.dev — Leaderboard Podium by trophy.so (2nd | 1st | 3rd, heights 1 > 2 > 3).
import { UI_IMAGES } from '@/lib/assets';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { WifiOff, CircleCheck, Flag } from 'lucide-react';
import type { LeaderboardEntry } from '@oc/shared';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { Avatar, Badge, Medal, medalForRank, LazyImage } from '@/components/ui';
import { LightRays } from '@/animations';

export interface LeaderboardProps {
  entries: LeaderboardEntry[];
  /** participantId להדגשה ("אני") */
  highlightId?: string;
  /** תצוגה מצומצמת (לחדר ההמתנה / sidebar) */
  compact?: boolean;
  /** פודיום ל־3 הראשונים מעל הרשימה */
  showPodium?: boolean;
  /** מספר מקסימלי של שורות (compact) */
  limit?: number;
  className?: string;
}

/** טבלת דירוג חיה – שורות זכוכית עם תגי דירוג ואנימציית שינוי מיקום */
export function Leaderboard({ entries, highlightId, compact, showPodium, limit, className }: LeaderboardProps) {
  const reduce = useReducedMotion();
  const sorted = [...entries].sort((a, b) => a.rank - b.rank || b.score - a.score);
  const podium = showPodium ? sorted.slice(0, 3) : [];
  const rest = showPodium ? sorted.slice(3) : sorted;
  const rows = limit ? rest.slice(0, limit) : rest;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {showPodium && podium.length > 0 && <Podium entries={podium} highlightId={highlightId} />}
      {rows.length > 0 && (
        <ol className={cn('flex flex-col', compact ? 'gap-2' : 'gap-2.5')} aria-label="טבלת דירוג">
          <AnimatePresence initial={false}>
            {rows.map((e) => {
              const me = e.participantId === highlightId;
              const medal = medalForRank(e.rank);
              return (
                <motion.li
                  key={e.participantId}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  className={cn(
                    'relative flex items-center gap-3 rounded-2xl px-2.5 ring-1',
                    'bg-gradient-to-b from-white/95 to-white/75 ring-white/80 shadow-[0_6px_16px_-10px_rgba(30,41,59,0.35),inset_0_1px_0_rgba(255,255,255,1)]',
                    compact ? 'min-h-12 py-1.5' : 'min-h-16 py-2 sm:px-4',
                    me && 'from-yellow-50 to-amber-100/80 ring-2 ring-brand-yellow shadow-[0_10px_22px_-10px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,1)]',
                    !e.connected && 'opacity-70',
                  )}
                  aria-current={me ? 'true' : undefined}
                >
                  <span
                    className={cn(
                      'grid shrink-0 place-items-center rounded-full font-black tabular-nums',
                      compact ? 'size-8 text-sm' : 'size-10 text-base',
                      medal
                        ? 'bg-transparent'
                        : 'bg-gradient-to-b from-slate-100 to-slate-300 text-slate-700 ring-1 ring-slate-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_4px_-1px_rgba(30,41,59,0.3)]',
                    )}
                    aria-label={`מקום ${e.rank}`}
                  >
                    {medal ? <Medal kind={medal} size="sm" /> : e.rank}
                  </span>
                  <Avatar id={e.avatar} size={compact ? 'sm' : 'md'} ring ringColor={me ? 'gold' : 'white'} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-bold', compact ? 'text-base' : 'text-lg')}>
                      {e.displayName}
                      {me && (
                        <Badge color="yellow" size="sm" solid className="ms-2 align-middle">אני</Badge>
                      )}
                    </span>
                    {!compact && (
                      <span className="mt-0.5 flex items-center gap-x-2 text-xs text-slate-500 sm:text-sm">
                        <span className="inline-flex items-center gap-1 whitespace-nowrap">
                          <CircleCheck className="size-4 text-brand-green" aria-hidden />
                          {e.correctAnswers}/{e.answeredCount}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="whitespace-nowrap" dir="ltr">{Math.round(e.accuracy)}%</span>
                        {e.finished && (
                          <span className="hidden items-center gap-1 whitespace-nowrap text-violet-700 sm:inline-flex">
                            <Flag className="size-4" aria-hidden /> סיים/ה
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  {!e.connected && (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400" title="לא מחובר/ת">
                      <WifiOff className="size-4" aria-hidden />
                      <span className="sr-only">לא מחובר/ת</span>
                    </span>
                  )}
                  <span className={cn('shrink-0 font-black tabular-nums text-violet-700', compact ? 'text-lg' : 'text-xl sm:text-2xl')}>
                    {formatNumber(e.score)}
                    <span className="ms-1 text-xs font-bold text-slate-400">נק׳</span>
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}
      {sorted.length === 0 && (
        <p className="rounded-2xl bg-white/70 p-4 text-center text-slate-500">עדיין אין נתונים בטבלה</p>
      )}
    </div>
  );
}

const PODIUM_ORDER = [2, 1, 3] as const; // כסף, זהב, ארד – הזהב באמצע
interface PodiumStyle {
  h: string;
  front: string;
  top: string;
  side: string;
  delay: number;
  label: string;
  glow: string;
}
const PODIUM_STYLE: Record<1 | 2 | 3, PodiumStyle> = {
  1: {
    h: 'h-32 sm:h-44 lg:h-52',
    front: 'from-yellow-300 via-amber-400 to-amber-600',
    top: 'from-yellow-100 to-yellow-300',
    side: 'from-amber-600 to-amber-800',
    delay: 0.5,
    label: 'מקום ראשון',
    glow: 'shadow-[0_26px_50px_-20px_rgba(245,158,11,0.75)]',
  },
  2: {
    h: 'h-24 sm:h-32 lg:h-40',
    front: 'from-slate-100 via-slate-300 to-slate-400',
    top: 'from-white to-slate-200',
    side: 'from-slate-400 to-slate-600',
    delay: 0.25,
    label: 'מקום שני',
    glow: 'shadow-[0_26px_50px_-20px_rgba(100,116,139,0.6)]',
  },
  3: {
    h: 'h-16 sm:h-24 lg:h-28',
    front: 'from-orange-300 via-orange-400 to-orange-600',
    top: 'from-orange-100 to-orange-300',
    side: 'from-orange-600 to-orange-800',
    delay: 0.05,
    label: 'מקום שלישי',
    glow: 'shadow-[0_26px_50px_-20px_rgba(194,65,12,0.6)]',
  },
};

/** פודיום תלת־ממדי: פאה קדמית + פאה עליונה בהירה + צד כהה, גביע עם זרקור */
export function Podium({ entries, highlightId }: { entries: LeaderboardEntry[]; highlightId?: string }) {
  const reduce = useReducedMotion();
  const byRank = new Map<number, LeaderboardEntry>();
  entries.forEach((e) => byRank.set(e.rank, e));
  return (
    <div className="relative flex items-end justify-center gap-3 px-2 pt-6 sm:gap-6 sm:px-4" aria-label="פודיום" role="list">
      {/* רצפת הבמה */}
      <div aria-hidden className="absolute inset-x-4 bottom-0 h-3 rounded-[50%] bg-gradient-to-b from-slate-300/70 to-slate-400/40 blur-[2px] sm:inset-x-10" />
      {PODIUM_ORDER.map((rank) => {
        const e = byRank.get(rank);
        const style = PODIUM_STYLE[rank];
        if (!e) return <div key={rank} className="w-24 sm:w-36 lg:w-44" aria-hidden />;
        const me = e.participantId === highlightId;
        const medal = medalForRank(rank)!;
        return (
          <motion.div
            key={e.participantId}
            role="listitem"
            aria-label={`${style.label}: ${e.displayName}, ${formatNumber(e.score)} נקודות`}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: reduce ? 0 : style.delay }}
            className="relative flex w-24 flex-col items-center sm:w-36 lg:w-44"
          >
            {rank === 1 && (
              <motion.div
                initial={reduce ? false : { scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14, delay: reduce ? 0 : 1 }}
                className="relative mb-1"
              >
                <LightRays color="rgb(254 240 138)" intensity={0.8} className="w-[300%]" />
                <LazyImage
                  src={UI_IMAGES.trophy}
                  alt="גביע האלופים"
                  eager
                  skeleton={false}
                  wrapperClassName="relative size-14 sm:size-20 lg:size-24 drop-shadow-[0_10px_16px_rgba(245,158,11,0.5)] animate-float"
                  className="size-full object-contain"
                  fallback={<span className="text-5xl sm:text-6xl leading-none">🏆</span>}
                />
              </motion.div>
            )}
            <div className={cn('relative', rank === 1 && 'animate-bounce-soft')}>
              <Avatar id={e.avatar} size={rank === 1 ? 'xl' : 'lg'} ring ringColor={rank === 1 ? 'gold' : me ? 'gold' : 'white'} glow={rank === 1} />
              <span className="absolute -bottom-2 -end-2">
                <Medal kind={medal} size={rank === 1 ? 'md' : 'sm'} />
              </span>
            </div>
            <p className={cn('mt-3 w-full truncate text-center font-black text-brand-navy', rank === 1 ? 'text-lg sm:text-xl' : 'text-base')} title={e.displayName}>
              {e.displayName}
            </p>
            {me && <Badge color="yellow" size="sm" solid>אני</Badge>}
            <p className="text-sm font-bold text-violet-700 tabular-nums">{formatNumber(e.score)} נק׳</p>

            {/* בלוק תלת־ממדי */}
            <motion.div
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ transformOrigin: 'bottom' }}
              transition={{ type: 'spring', stiffness: 200, damping: 24, delay: reduce ? 0 : style.delay }}
              className={cn('relative mt-3 w-full', style.h)}
              aria-hidden
            >
              {/* צד (כהה) */}
              <span
                className={cn('absolute -start-2.5 top-0 bottom-0 w-2.5 bg-gradient-to-b sm:-start-3 sm:w-3', style.side)}
                style={{ transform: 'skewY(45deg)', transformOrigin: 'top right' }}
              />
              {/* פאה עליונה (בהירה) */}
              <span
                className={cn('absolute inset-x-0 -top-2.5 h-2.5 bg-gradient-to-b sm:-top-3 sm:h-3', style.top)}
                style={{ transform: 'skewX(-45deg)', transformOrigin: 'bottom left' }}
              />
              {/* פאה קדמית */}
              <div
                className={cn(
                  'relative grid size-full place-items-center overflow-hidden bg-gradient-to-b text-white',
                  'shadow-[inset_0_3px_0_rgba(255,255,255,0.55),inset_0_-8px_16px_rgba(0,0,0,0.18)]',
                  style.front,
                  style.glow,
                )}
              >
                <span className="pointer-events-none absolute inset-0 pattern-dots opacity-40" />
                <span className="pointer-events-none absolute inset-y-0 start-[8%] w-[14%] bg-gradient-to-r from-white/0 via-white/45 to-white/0" />
                <span className="relative text-4xl font-black text-extrude sm:text-5xl lg:text-6xl" dir="ltr">{rank}</span>
              </div>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default Leaderboard;
