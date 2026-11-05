import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { WifiOff, CircleCheck, Flag } from 'lucide-react';
import type { LeaderboardEntry } from '@oc/shared';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { Avatar, Badge, Medal, medalForRank, LazyImage } from '@/components/ui';

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

/** טבלת דירוג חיה עם אנימציית שינוי מיקום */
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
        <ol className={cn('flex flex-col', compact ? 'gap-1.5' : 'gap-2.5')} aria-label="טבלת דירוג">
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
                    'flex items-center gap-3 rounded-2xl bg-white px-3 shadow-sm ring-1 ring-black/5',
                    compact ? 'min-h-12 py-1.5' : 'min-h-16 py-2 sm:px-4',
                    me && 'bg-yellow-50 ring-2 ring-brand-yellow shadow-card',
                    !e.connected && 'opacity-70',
                  )}
                  aria-current={me ? 'true' : undefined}
                >
                  <span
                    className={cn(
                      'grid shrink-0 place-items-center rounded-full font-black tabular-nums',
                      compact ? 'size-8 text-sm' : 'size-10 text-base',
                      medal ? 'bg-transparent' : 'bg-slate-100 text-slate-700',
                    )}
                    aria-label={`מקום ${e.rank}`}
                  >
                    {medal ? <Medal kind={medal} size="sm" /> : e.rank}
                  </span>
                  <Avatar id={e.avatar} size={compact ? 'sm' : 'md'} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate font-bold', compact ? 'text-base' : 'text-lg')}>
                      {e.displayName}
                      {me && (
                        <Badge color="yellow" size="sm" className="ms-2 align-middle">אני</Badge>
                      )}
                    </span>
                    {!compact && (
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 sm:text-sm">
                        <span className="inline-flex items-center gap-1">
                          <CircleCheck className="size-4 text-brand-green" aria-hidden />
                          {e.correctAnswers}/{e.answeredCount} נכונות
                        </span>
                        <span dir="ltr">{Math.round(e.accuracy)}% דיוק</span>
                        {e.finished && (
                          <span className="inline-flex items-center gap-1 text-violet-700">
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
const PODIUM_STYLE: Record<1 | 2 | 3, { h: string; bg: string; delay: number; label: string }> = {
  1: { h: 'h-36 sm:h-44', bg: 'bg-gradient-to-t from-yellow-500 to-yellow-300', delay: 0.5, label: 'מקום ראשון' },
  2: { h: 'h-24 sm:h-32', bg: 'bg-gradient-to-t from-slate-400 to-slate-200', delay: 0.25, label: 'מקום שני' },
  3: { h: 'h-16 sm:h-24', bg: 'bg-gradient-to-t from-orange-500 to-orange-300', delay: 0.05, label: 'מקום שלישי' },
};

export function Podium({ entries, highlightId }: { entries: LeaderboardEntry[]; highlightId?: string }) {
  const reduce = useReducedMotion();
  const byRank = new Map<number, LeaderboardEntry>();
  entries.forEach((e) => byRank.set(e.rank, e));
  return (
    <div className="flex items-end justify-center gap-2 sm:gap-5" aria-label="פודיום">
      {PODIUM_ORDER.map((rank) => {
        const e = byRank.get(rank);
        const style = PODIUM_STYLE[rank];
        if (!e) return <div key={rank} className="w-24 sm:w-36" aria-hidden />;
        const me = e.participantId === highlightId;
        const medal = medalForRank(rank)!;
        return (
          <motion.div
            key={e.participantId}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22, delay: reduce ? 0 : style.delay }}
            className="flex w-24 flex-col items-center sm:w-36"
          >
            {rank === 1 && (
              <motion.div
                initial={reduce ? false : { scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14, delay: reduce ? 0 : 1 }}
                className="mb-1"
              >
                <LazyImage
                  src="/images/ui/trophy.svg"
                  alt="גביע האלופים"
                  eager
                  skeleton={false}
                  wrapperClassName="size-14 sm:size-20 drop-shadow-lg"
                  className="size-full object-contain"
                  fallback={<span className="text-5xl sm:text-6xl leading-none">🏆</span>}
                />
              </motion.div>
            )}
            <div className={cn('relative', rank === 1 && 'animate-bounce-soft')}>
              <Avatar id={e.avatar} size={rank === 1 ? 'xl' : 'lg'} ring className={cn(me && 'ring-brand-yellow')} />
              <span className="absolute -bottom-2 -end-2">
                <Medal kind={medal} size={rank === 1 ? 'md' : 'sm'} />
              </span>
            </div>
            <p className={cn('mt-3 w-full truncate text-center font-bold', rank === 1 ? 'text-lg sm:text-xl' : 'text-base')} title={e.displayName}>
              {e.displayName}
            </p>
            {me && <Badge color="yellow" size="sm">אני</Badge>}
            <p className="text-sm font-bold text-violet-700 tabular-nums">{formatNumber(e.score)} נק׳</p>
            <motion.div
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ transformOrigin: 'bottom' }}
              transition={{ type: 'spring', stiffness: 200, damping: 24, delay: reduce ? 0 : style.delay }}
              className={cn('mt-2 grid w-full place-items-center rounded-t-2xl text-3xl font-black text-white shadow-card sm:text-4xl', style.h, style.bg)}
              aria-label={style.label}
            >
              {rank}
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default Leaderboard;
