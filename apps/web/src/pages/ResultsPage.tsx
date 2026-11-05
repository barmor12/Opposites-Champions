import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { DoorOpen, RotateCcw, Trophy } from 'lucide-react';
import { ACHIEVEMENT_LABELS, GameState } from '@oc/shared';
import { Confetti } from '@/animations';
import { useSound } from '@/hooks/useSound';
import { Button, Card, Character, PageBackground, SoundToggle, Spinner, Badge } from '@/components/ui';
import { Leaderboard } from '@/components/Leaderboard';
import { usePlayerStore } from '@/stores/playerStore';
import { formatNumber } from '@/lib/format';

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

  return (
    <main className="relative flex min-h-dvh flex-col items-center px-3 pb-10 pt-3 sm:px-4">
      <PageBackground variant="sunset" rainbow />
      <Confetti active={confetti && !reduce} />

      <div className="flex w-full max-w-3xl items-center justify-between">
        <Badge color="navy" size="lg" icon={<Trophy className="size-5" />}>תוצאות</Badge>
        <SoundToggle />
      </div>

      <motion.header
        initial={reduce ? false : { opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 flex flex-col items-center text-center"
      >
        <h1 className="text-shadow-pop text-3xl font-black sm:text-5xl">🏆 אלופי ההפכים 🏆</h1>
        {room && <p className="mt-1 text-lg font-bold text-violet-800">{room.className}</p>}
      </motion.header>

      {loading ? (
        <Spinner size="lg" className="mt-10 text-brand-violet" />
      ) : (
        <div className="mt-5 flex w-full max-w-3xl flex-col gap-5">
          {/* כרטיס אישי */}
          <Card variant="glass" className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-start">
            <Character name={myRank === 1 ? 'sun' : 'moon'} mood={myRank === 1 ? 'cheer' : 'happy'} size="sm" animate="bounce" />
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-500">כל הכבוד,</p>
              <p className="text-2xl font-black">{displayName}</p>
              <p className="mt-1 text-lg font-bold text-violet-800">
                {myRank ? `מקום ${myRank} בכיתה` : 'סיימת את המשחק!'} · {formatNumber(me?.score ?? score)} נקודות ·{' '}
                {me?.correctAnswers ?? correctAnswers}/{me?.answeredCount ?? answeredCount} נכונות
              </p>
            </div>
          </Card>

          {/* הישגים */}
          {achievements.length > 0 && (
            <section aria-labelledby="ach-title">
              <h2 id="ach-title" className="mb-2 text-center text-xl font-black">ההישגים שלך</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {achievements.map((a, i) => {
                  const info = ACHIEVEMENT_LABELS[a];
                  return (
                    <motion.li
                      key={a}
                      initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -6 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 16, delay: reduce ? 0 : 0.8 + i * 0.15 }}
                      className="flex flex-col items-center gap-1 rounded-bubble bg-gradient-to-b from-yellow-100 to-orange-100 p-4 text-center shadow-card ring-2 ring-yellow-300"
                    >
                      <span className="text-4xl leading-none" aria-hidden>{info.emoji}</span>
                      <span className="font-black">{info.title}</span>
                      <span className="text-xs font-bold text-slate-600 sm:text-sm">{info.description}</span>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* פודיום + דירוג */}
          {showLeaderboard ? (
            leaderboard.length > 0 ? (
              <Card padding="sm" className="overflow-hidden">
                <Leaderboard entries={leaderboard} highlightId={participantId ?? undefined} showPodium />
              </Card>
            ) : (
              <Card className="text-center text-slate-600">הדירוג המלא יוצג אצל המורה</Card>
            )
          ) : (
            <Card className="text-center text-lg font-bold text-slate-600">המורה בחרה להציג את הדירוג על הלוח 🎓</Card>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="xl" fullWidth icon={<RotateCcw className="size-6" />} onClick={() => navigate('/play')}>
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
      )}
    </main>
  );
}

export default ResultsPage;
