import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LogOut, Hourglass } from 'lucide-react';
import { GameState, GameMode, type AnswerPayload, type AnswerResult } from '@oc/shared';
import { QuestionRenderer } from '@/games';
import { useSound } from '@/hooks/useSound';
import { Avatar, Button, Card, Character, Countdown, PageBackground, SoundToggle, Spinner, toast } from '@/components/ui';
import { usePlayerStore } from '@/stores/playerStore';
import { errorMessage } from '@/services/api';
import { QuestionHeader } from '@/components/play/QuestionHeader';
import { WaitingRoom } from '@/components/play/WaitingRoom';
import { PausedOverlay } from '@/components/play/PausedOverlay';
import { FinishedWaiting } from '@/components/play/FinishedWaiting';
import { ConnectionBadge } from '@/components/play/ConnectionBadge';

type Screen = 'loading' | 'waiting' | 'countdown' | 'question' | 'preparing' | 'finished' | 'cancelled' | 'error';

export function PlayPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { play, enabled: soundsEnabled } = useSound();

  const token = usePlayerStore((s) => s.token);
  const status = usePlayerStore((s) => s.status);
  const error = usePlayerStore((s) => s.error);
  const room = usePlayerStore((s) => s.room);
  const gameState = usePlayerStore((s) => s.gameState);
  const countdown = usePlayerStore((s) => s.countdown);
  const question = usePlayerStore((s) => s.currentQuestion);
  const lastResult = usePlayerStore((s) => s.lastResult);
  const awaitingTeacher = usePlayerStore((s) => s.awaitingTeacher);
  const finished = usePlayerStore((s) => s.finished);
  const finishedCount = usePlayerStore((s) => s.finishedCount);
  const participantCount = usePlayerStore((s) => s.participantCount);
  const score = usePlayerStore((s) => s.score);
  const streak = usePlayerStore((s) => s.streak);
  const correctAnswers = usePlayerStore((s) => s.correctAnswers);
  const answeredCount = usePlayerStore((s) => s.answeredCount);
  const leaderboard = usePlayerStore((s) => s.leaderboard);
  const participantId = usePlayerStore((s) => s.participantId);
  const displayName = usePlayerStore((s) => s.displayName);
  const avatar = usePlayerStore((s) => s.avatar);
  const connection = usePlayerStore((s) => s.connection);
  const serverOffsetMs = usePlayerStore((s) => s.serverOffsetMs);
  const removedReason = usePlayerStore((s) => s.removedReason);
  const socketError = usePlayerStore((s) => s.socketError);
  const restoreSession = usePlayerStore((s) => s.restoreSession);
  const bindSocket = usePlayerStore((s) => s.bindSocket);
  const unbindSocket = usePlayerStore((s) => s.unbindSocket);
  const submitAnswer = usePlayerStore((s) => s.submitAnswer);
  const next = usePlayerStore((s) => s.next);
  const leave = usePlayerStore((s) => s.leave);

  // ===== שחזור/חיבור =====
  useEffect(() => {
    if (!token) {
      navigate('/', { replace: true });
      return;
    }
    let active = true;
    restoreSession().then((s) => {
      if (!active) return;
      if (s) bindSocket();
    });
    return () => {
      active = false;
    };
  }, [token, restoreSession, bindSocket, navigate]);

  useEffect(() => () => unbindSocket(), [unbindSocket]);

  // הוסרנו ע"י המורה
  useEffect(() => {
    if (removedReason) navigate('/', { replace: true });
  }, [removedReason, navigate]);

  // שגיאות socket
  useEffect(() => {
    if (socketError) toast.error(socketError.message);
  }, [socketError]);

  // תוצאות סופיות
  useEffect(() => {
    if (gameState === GameState.FINAL_RESULTS || gameState === GameState.COMPLETED) {
      navigate('/results', { replace: true });
    }
  }, [gameState, navigate]);

  // צלילים
  const prevState = useRef<GameState | null>(null);
  useEffect(() => {
    if (gameState === GameState.COUNTDOWN && prevState.current !== GameState.COUNTDOWN) play('tick');
    prevState.current = gameState;
  }, [gameState, play]);

  const paused = gameState === GameState.PAUSED;
  const isTeacherPaced = room?.mode === GameMode.TEACHER_PACED;

  const screen: Screen = useMemo(() => {
    if (!token) return 'loading';
    if (status === 'error' && !room) return 'error';
    if (status === 'restoring' || status === 'idle' || !room) return 'loading';
    switch (gameState) {
      case GameState.CREATED:
      case GameState.WAITING_FOR_PLAYERS:
        return 'waiting';
      case GameState.COUNTDOWN:
        return countdown ? 'countdown' : 'preparing';
      case GameState.CANCELLED:
      case GameState.EXPIRED:
        return 'cancelled';
      case GameState.FINAL_RESULTS:
      case GameState.COMPLETED:
        return 'loading';
      default:
        if (finished) return 'finished';
        if (question) return 'question';
        return 'preparing';
    }
  }, [token, status, room, gameState, countdown, finished, question]);

  const onAnswer = useCallback(
    async (payload: AnswerPayload): Promise<AnswerResult> => {
      try {
        const r = await submitAnswer(payload);
        play(r.correct ? 'correct' : 'wrong');
        if (r.treasureCompleted) play('fanfare');
        return r;
      } catch (err) {
        toast.error(errorMessage(err));
        throw err;
      }
    },
    [submitAnswer, play],
  );

  const onNext = useCallback(() => {
    play('click');
    next().catch((err) => toast.error(errorMessage(err)));
  }, [next, play]);

  const onExpire = useCallback(() => {
    // נגמר הזמן בלי תשובה – בקצב אישי עוברים הלאה; בקצב מורה השרת סוגר את השאלה
    const s = usePlayerStore.getState();
    if (s.lastResult || s.gameState === GameState.PAUSED) return;
    if (s.room?.mode === GameMode.TEACHER_PACED) {
      s.hydrate({ awaitingTeacher: true });
      return;
    }
    s.next().catch((err) => toast.error(errorMessage(err)));
  }, []);

  const onLeave = () => {
    if (window.confirm('לצאת מהמשחק?')) {
      leave();
      navigate('/', { replace: true });
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col px-3 pb-8 pt-3 sm:px-4 sm:pt-4">
      <PageBackground variant={screen === 'question' ? 'day' : 'day'} rainbow={screen === 'waiting'} />

      {/* סרגל עליון */}
      <div className="mx-auto mb-3 flex w-full max-w-3xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {avatar && <Avatar id={avatar} size="sm" ring />}
          <span className="truncate font-bold text-brand-navy/80">{displayName}</span>
          <ConnectionBadge status={connection} />
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle />
          <Button variant="ghost" size="md" aria-label="יציאה מהמשחק" onClick={onLeave} icon={<LogOut className="size-5" />}>
            <span className="hidden sm:inline">יציאה</span>
          </Button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen === 'question' && question ? `q-${question.sessionQuestionId}` : screen}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="flex flex-1 flex-col"
          >
            {screen === 'loading' && <CenterMessage spinner text="מתחברים למשחק…" />}
            {screen === 'error' && (
              <CenterMessage text={error ?? 'לא הצלחנו להתחבר'}>
                <div className="flex gap-3">
                  <Button onClick={() => restoreSession().then((s) => s && bindSocket())}>לנסות שוב</Button>
                  <Button variant="secondary" onClick={() => { leave(); navigate('/'); }}>לדף הבית</Button>
                </div>
              </CenterMessage>
            )}
            {screen === 'waiting' && room && avatar && (
              <WaitingRoom
                room={room}
                displayName={displayName}
                avatar={avatar}
                participantCount={participantCount}
                connection={connection}
                leaderboard={leaderboard}
                participantId={participantId}
              />
            )}
            {screen === 'countdown' && countdown && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6">
                <Countdown startsAt={countdown.startsAt} seconds={countdown.seconds} serverOffsetMs={serverOffsetMs} />
                <div className="flex gap-8">
                  <Character name="sun" mood="cheer" size="sm" animate="bounce" />
                  <Character name="moon" mood="happy" size="sm" animate="bounce" delay={0.3} />
                </div>
              </div>
            )}
            {screen === 'preparing' && <CenterMessage spinner text="מכינים את השאלה הבאה…" />}
            {screen === 'question' && question && room && (
              <div className="flex flex-1 flex-col gap-4">
                <QuestionHeader
                  question={question}
                  score={score}
                  streak={streak}
                  serverOffsetMs={serverOffsetMs}
                  answered={Boolean(lastResult)}
                  paused={paused}
                  onExpire={onExpire}
                />
                <div className="flex-1">
                  <QuestionRenderer
                    key={question.sessionQuestionId}
                    question={question}
                    result={lastResult}
                    onAnswer={onAnswer}
                    onNext={onNext}
                    soundsEnabled={soundsEnabled && room.settings.soundsEnabled}
                    showCorrectAnswers={room.settings.showCorrectAnswers}
                    serverOffsetMs={serverOffsetMs}
                  />
                </div>
                {isTeacherPaced && awaitingTeacher && (
                  <Card variant="glass" padding="sm" className="flex items-center justify-center gap-3 text-lg font-bold text-violet-800" role="status">
                    <Hourglass className="size-6 animate-[spin_3s_linear_infinite]" aria-hidden /> מחכים שהמורה תעבור לשאלה הבאה…
                  </Card>
                )}
              </div>
            )}
            {screen === 'finished' && room && (
              <FinishedWaiting
                score={score}
                correctAnswers={correctAnswers}
                answeredCount={answeredCount}
                finishedCount={finishedCount}
                participantCount={participantCount}
                showLeaderboard={room.settings.showLeaderboard}
                leaderboard={leaderboard}
                participantId={participantId}
              />
            )}
            {screen === 'cancelled' && (
              <CenterMessage text="המשחק הסתיים או בוטל על ידי המורה">
                <Button onClick={() => { leave(); navigate('/'); }}>חזרה לדף הבית</Button>
              </CenterMessage>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <PausedOverlay open={paused} />
    </main>
  );
}

function CenterMessage({ text, spinner, children }: { text: string; spinner?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <Card variant="glass" className="flex flex-col items-center gap-4">
        {spinner ? <Spinner size="lg" className="text-brand-violet" /> : <Character name="moon" mood="think" size="sm" animate="wiggle" />}
        <p className="text-xl font-bold" role="status">{text}</p>
        {children}
      </Card>
    </div>
  );
}

export default PlayPage;
