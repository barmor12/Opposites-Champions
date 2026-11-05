import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { DoorOpen, RotateCcw, Trophy } from 'lucide-react';
import { ACHIEVEMENT_LABELS, GameState } from '@oc/shared';
import { Confetti, LightRays } from '@/animations';
import { useSound } from '@/hooks/useSound';
import { Button, Card, Character, PageBackground, SoundToggle, Spinner, Badge, NumberTicker } from '@/components/ui';
import { Leaderboard } from '@/components/Leaderboard';
import { usePlayerStore } from '@/stores/playerStore';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

export function ResultsPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { play } = useSound();

  const token = usePlayerStore((s) => s.token);
  const status = usePlayerStore((s) => s.status);
  const room = usePlayerStore((s) => s.room);
  const gameState = usePlayerStore((s) => s.gameState);
  const leaderboard = usePlayerStore((s) => s.leaderboard);
  const achievements = usePlayerStore((s) => s.achievements);
  const participantId = usePlayerStore((s) => s.participantId);
  const displayName = usePlayerStore((s) => s.displayName);
  const score = usePlayerStore((s) => s.score);
  const correctAnswers = usePlayerStore((s) => s.correctAnswers);
  const answeredCount = usePlayerStore((s) => s.answeredCount);
  const removedReason = usePlayerStore((s) => s.removedReason);
  const restoreSession = usePlayerStore((s) => s.restoreSession);
  const bindSocket = usePlayerStore((s) => s.bindSocket);
  const unbindSocket = usePlayerStore((s) => s.unbindSocket);
  const leave = usePlayerStore((s) => s.leave);

  const [confetti, setConfetti] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
      return;
    }
    let active = true;
    restoreSession().then((s) => {
      if (active && s) bindSocket();
    });
    return () => {
      active = false;
    };
  }, [token, restoreSession, bindSocket, navigate]);

  useEffect(() => () => unbindSocket(), [unbindSocket]);

  useEffect(() => {
    if (removedReason) navigate('/', { replace: true });
  }, [removedReason, navigate]);

  // המורה פתחה סבב חדש → חזרה לחדר ההמתנה
  useEffect(() => {
    if (gameState === GameState.WAITING_FOR_PLAYERS || gameState === GameState.COUNTDOWN || gameState === GameState.QUESTION_ACTIVE) {
      navigate('/play', { replace: true });
    }
  }, [gameState, navigate]);

  useEffect(() => {
    play('fanfare');
    const t = window.setTimeout(() => setConfetti(false), 7000);
    return () => window.clearTimeout(t);
  }, [play]);

  const me = useMemo(() => leaderboard.find((e) => e.participantId === participantId), [leaderboard, participantId]);
  const myRank = me?.rank;
  const showLeaderboard = room?.settings.showLeaderboard ?? true;
  const loading = status === 'restoring' && !room;
  const myScore = me?.score ?? score;
  const myCorrect = me?.correctAnswers ?? correctAnswers;
  const myAnswered = me?.answeredCount ?? answeredCount;

  return (
    <main data-testid="results-page" className="relative flex min-h-dvh flex-col overflow-x-clip items-center safe-x safe-bottom pt-3 sm:pt-4">
      <PageBackground variant="sunset" rainbow />
      <Confetti active={confetti && !reduce} />

      <div className="flex w-full max-w-4xl items-center justify-between">
        <Badge color="navy" size="lg" icon={<Trophy className="size-5" />}>תוצאות</Badge>
        <SoundToggle />
      </div>

      <motion.header
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mt-3 flex flex-col items-center text-center"
      >
        <LightRays color="rgb(255 255 255)" intensity={0.45} className="w-[180%]" />
        <h1 className="relative isolate inline-grid place-items-center whitespace-nowrap px-2 text-fluid-hero font-black leading-[1.05]">
          <span
            aria-hidden
            className="col-start-1 row-start-1 text-transparent [paint-order:stroke_fill] [-webkit-text-stroke:0.22em_white]"
            style={{ filter: 'drop-shadow(0 6px 0 rgb(109 40 217 / 0.35)) drop-shadow(0 16px 24px rgb(30 41 59 / 0.3))' }}
          >
            אלופי ההפכים
          </span>
          <span className="relative z-10 col-start-1 row-start-1 text-gradient-brand">אלופי ההפכים</span>
        </h1>
        {room && <p className="relative mt-1 text-lg font-black text-violet-900 text-shadow-pop sm:text-xl">{room.className}</p>}
      </motion.header>

      {loading ? (
        <Spinner size="lg" className="mt-10 text-brand-violet" />
      ) : (
        <div className="mt-5 grid w-full max-w-4xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
          <div className="flex flex-col gap-5 lg:sticky lg:top-6">
            {/* כרטיס אישי */}
            <Card variant="glass" spotlight className="relative flex flex-col items-center gap-3 overflow-hidden text-center shadow-float sm:flex-row sm:text-start lg:flex-col lg:text-center">
              <div className="relative shrink-0">
                <LightRays color="rgb(250 204 21)" intensity={0.5} className="w-[260%]" />
                <Character name={myRank === 1 ? 'sun' : 'moon'} mood={myRank === 1 ? 'cheer' : 'happy'} size="sm" animate="bounce" className="relative" />
              </div>
              <div className="relative flex-1">
                <p className="text-sm font-bold text-slate-500">כל הכבוד,</p>
                <p className="text-fluid-title font-black text-brand-navy">{displayName}</p>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start lg:justify-center">
                  {myRank && (
                    <Badge color={myRank <= 3 ? 'yellow' : 'violet'} size="lg" solid icon={<Trophy className="size-5" />}>
                      מקום {myRank} בכיתה
                    </Badge>
                  )}
                  {!myRank && <Badge color="violet" size="lg" solid>סיימת את המשחק!</Badge>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <StatTile label="נקודות" color="from-violet-400 to-violet-700 border-violet-900">
                    <NumberTicker value={myScore} fromZero transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} />
                  </StatTile>
                  <StatTile label="תשובות נכונות" color="from-green-400 to-green-700 border-green-900">
                    <span dir="ltr">
                      {myCorrect}/{myAnswered}
                    </span>
                  </StatTile>
                </div>
                <span className="sr-only">{formatNumber(myScore)} נקודות</span>
              </div>
            </Card>

            {/* הישגים */}
            {achievements.length > 0 && (
              <section aria-labelledby="ach-title">
                <h2 id="ach-title" className="mb-2 text-center text-xl font-black text-brand-navy text-shadow-pop">ההישגים שלך</h2>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                  {achievements.map((a, i) => {
                    const info = ACHIEVEMENT_LABELS[a];
                    return (
                      <motion.li
                        key={a}
                        initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -6 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 16, delay: reduce ? 0 : 0.8 + i * 0.15 }}
                        className={cn(
                          'relative flex flex-col items-center gap-1 overflow-hidden rounded-bubble border-b-[5px] border-amber-500 bg-gradient-to-b from-yellow-100 via-amber-100 to-orange-200 p-4 text-center',
                          'shadow-[0_14px_28px_-12px_rgba(245,158,11,0.6),inset_0_2px_0_rgba(255,255,255,0.9)] ring-1 ring-amber-300/70 sheen-overlay',
                        )}
                      >
                        <span className="grid size-14 place-items-center rounded-full bg-gradient-to-b from-white to-amber-100 text-3xl leading-none shadow-[inset_0_-3px_6px_rgba(180,83,9,0.25),0_6px_12px_-6px_rgba(180,83,9,0.5)] ring-2 ring-white" aria-hidden>
                          {info.emoji}
                        </span>
                        <span className="font-black text-amber-950">{info.title}</span>
                        <span className="text-xs font-bold text-amber-900/75 sm:text-sm">{info.description}</span>
                      </motion.li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {/* פודיום + דירוג */}
            {showLeaderboard ? (
              leaderboard.length > 0 ? (
                <Card padding="sm" variant="glass" className="overflow-hidden shadow-float sm:p-5">
                  <Leaderboard entries={leaderboard} highlightId={participantId ?? undefined} showPodium />
                </Card>
              ) : (
                <Card variant="glass" className="text-center text-slate-600">הדירוג המלא יוצג אצל המורה</Card>
              )
            ) : (
              <Card variant="glass" className="text-center text-lg font-bold text-slate-600">המורה בחרה להציג את הדירוג על הלוח 🎓</Card>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="xl" fullWidth glow icon={<RotateCcw className="size-6" />} onClick={() => navigate('/play')}>
                חזרה לחדר ההמתנה
              </Button>
              <Button
                size="xl"
                fullWidth
                variant="secondary"
                icon={<DoorOpen className="size-6" />}
                onClick={() => {
                  leave();
                  navigate('/', { replace: true });
                }}
              >
                יציאה
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatTile({ label, color, children }: { label: string; color: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center overflow-hidden rounded-2xl border-b-[5px] bg-gradient-to-b px-2 py-2.5 text-white',
        'shadow-[0_12px_24px_-10px_rgba(30,41,59,0.45),inset_0_2px_0_rgba(255,255,255,0.45)]',
        color,
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-full bg-gradient-to-b from-white/30 to-transparent" />
      <span className="relative text-2xl font-black tabular-nums text-shadow-soft">{children}</span>
      <span className="relative text-xs font-bold opacity-90 sm:text-sm">{label}</span>
    </div>
  );
}

export default ResultsPage;
