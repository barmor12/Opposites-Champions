import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  DoorClosed,
  DoorOpen,
  Flag,
  Hourglass,
  Link2,
  Minus,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Timer,
  Trophy,
  UserMinus,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { GameMode, GameState, type LeaderboardEntry, type ParticipantView } from '@oc/shared';
import { Avatar, Button, Card, EmptyState, Medal, ProgressBar, Spinner, medalForRank, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useTeacherStore, type LiveEvent, type RoomAction } from '@/stores/teacherStore';
import { ConfirmModal, CountUp, HIT_AREA, MagicButton, PageHeader, Panel, StateBadge, Stepper, type StepperStep } from './components';
import { MODE_LABELS, STATE_LABELS, formatNumber, friendlyError, teacherPath } from './labels';

/** אחרי כמות זו של הודעות על תלמידים – משתיקים כדי לא להציף. */
const PLAYER_TOAST_LIMIT = 40;

type Confirm = 'finish' | 'cancel' | 'new-round' | { remove: ParticipantView } | null;

const IN_PLAY: readonly GameState[] = [GameState.QUESTION_ACTIVE, GameState.QUESTION_RESULTS, GameState.NEXT_QUESTION];

const TIMELINE: readonly StepperStep[] = [
  { key: 'waiting', label: 'ממתינים', icon: Hourglass },
  { key: 'countdown', label: 'ספירה', icon: Timer },
  { key: 'questions', label: 'שאלות', icon: Play },
  { key: 'results', label: 'תוצאות', icon: Trophy },
];

function timelineIndex(state: GameState): number {
  switch (state) {
    case GameState.CREATED:
    case GameState.WAITING_FOR_PLAYERS:
      return 0;
    case GameState.COUNTDOWN:
      return 1;
    case GameState.QUESTION_ACTIVE:
    case GameState.QUESTION_RESULTS:
    case GameState.NEXT_QUESTION:
    case GameState.PAUSED:
      return 2;
    case GameState.FINAL_RESULTS:
      return 3;
    case GameState.COMPLETED:
      return 4;
    default:
      return -1;
  }
}

export function LiveRoomPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const live = useTeacherStore((s) => s.live);
  const liveLoading = useTeacherStore((s) => s.liveLoading);
  const liveError = useTeacherStore((s) => s.liveError);
  const socketConnected = useTeacherStore((s) => s.socketConnected);
  const pendingAction = useTeacherStore((s) => s.pendingAction);
  const loadLive = useTeacherStore((s) => s.loadLive);
  const bindRoom = useTeacherStore((s) => s.bindRoom);
  const clearLive = useTeacherStore((s) => s.clearLive);
  const runRoomAction = useTeacherStore((s) => s.runRoomAction);
  const setJoinOpen = useTeacherStore((s) => s.setJoinOpen);
  const newRound = useTeacherStore((s) => s.newRound);
  const removeParticipant = useTeacherStore((s) => s.removeParticipant);

  const [confirm, setConfirm] = useState<Confirm>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const playerToasts = useRef(0);

  useEffect(() => {
    if (!id) return;
    playerToasts.current = 0;
    void loadLive(id);
    const unbind = bindRoom(id, (event: LiveEvent) => {
      const playerToast = (fn: () => void) => {
        playerToasts.current += 1;
        if (playerToasts.current === PLAYER_TOAST_LIMIT) {
          toast.success('הודעות על תלמידים הושתקו – הרשימה ממשיכה להתעדכן');
          return;
        }
        if (playerToasts.current < PLAYER_TOAST_LIMIT) fn();
      };
      switch (event.type) {
        case 'player:connected':
          playerToast(() => toast.success(`${event.displayName} הצטרף/ה לחדר`));
          break;
        case 'player:disconnected':
          playerToast(() => toast.error(`${event.displayName ?? 'תלמיד/ה'} התנתק/ה`));
          break;
        case 'player:finished':
          playerToast(() => toast.success(`${event.displayName ?? 'תלמיד/ה'} סיים/ה את המשחק (${event.finishedCount}/${event.participantCount})`));
          break;
        case 'game:started':
          toast.success('המשחק התחיל!');
          break;
        case 'game:finished':
          toast.success('המשחק הסתיים – התוצאות מוכנות');
          break;
        case 'socket:disconnected':
          toast.error('החיבור לחדר נותק – מנסים להתחבר מחדש');
          break;
        case 'error':
          toast.error(event.message);
          break;
        default:
          break;
      }
    });
    return () => {
      unbind();
      clearLive();
    };
  }, [id, loadLive, bindRoom, clearLive]);

  const room = live?.room;
  const state = room?.state;
  const isTeacherPaced = room?.mode === GameMode.TEACHER_PACED;

  const connectedCount = useMemo(() => live?.participants.filter((p) => p.connected).length ?? 0, [live]);
  const totalCount = live?.participants.length ?? 0;
  const questionCount = room?.questionCount ?? 0;

  const roundProgress = useMemo(() => {
    if (!live || !room) return { value: 0, max: 1, label: '' };
    if (room.mode === GameMode.TEACHER_PACED) {
      const idx = live.currentQuestionIndex ?? room.currentQuestionIndex;
      const value = idx === null ? 0 : Math.min(idx + 1, questionCount);
      return { value, max: Math.max(questionCount, 1), label: idx === null ? 'טרם התחיל' : `שאלה ${value} מתוך ${questionCount}` };
    }
    const answered = live.participants.reduce((sum, p) => sum + p.answeredCount, 0);
    const max = Math.max(questionCount * Math.max(totalCount, 1), 1);
    return { value: answered, max, label: `${Math.round((answered / max) * 100)}% מהשאלות נענו` };
  }, [live, room, questionCount, totalCount]);

  const act = async (action: RoomAction) => {
    try {
      await runRoomAction(id, action);
    } catch (err) {
      toast.error(friendlyError(err, 'הפעולה נכשלה'));
      throw err;
    }
  };

  const copy = async (text: string, what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      toast.success(what === 'code' ? 'הקוד הועתק' : 'הקישור הועתק');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('לא הצלחנו להעתיק – העתיקו ידנית');
    }
  };

  if (liveError && !live) {
    return (
      <div>
        <PageHeader title="חדר חי" crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: 'חדר' }]} />
        <Card variant="glass" padding="none" className="p-6 sm:p-8">
          <EmptyState title="לא הצלחנו לטעון את החדר" description={liveError} className="bg-transparent" />
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" size="md" onClick={() => void loadLive(id)}>
              <RefreshCw className="size-4" aria-hidden /> ניסיון נוסף
            </Button>
            <Button variant="ghost" size="md" onClick={() => navigate(teacherPath())}>
              <ArrowRight className="size-4" aria-hidden /> ללוח הבקרה
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!live || !room || !state) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="text-violet-700" />
      </div>
    );
  }

  const busy = pendingAction !== null;
  const isWaiting = state === GameState.WAITING_FOR_PLAYERS || state === GameState.CREATED;
  const isEnded = state === GameState.CANCELLED || state === GameState.EXPIRED;
  const canFinish = IN_PLAY.includes(state) || state === GameState.PAUSED || state === GameState.COUNTDOWN;
  const canCancel = !isEnded && state !== GameState.COMPLETED && state !== GameState.FINAL_RESULTS;
  const canToggleJoin = !isEnded && state !== GameState.FINAL_RESULTS && state !== GameState.COMPLETED;
  const showNext = isTeacherPaced && (state === GameState.QUESTION_ACTIVE || state === GameState.QUESTION_RESULTS);
  const currentQuestionNumber = (live.currentQuestionIndex ?? room.currentQuestionIndex ?? -1) + 1;
  const timeline = timelineIndex(state);

  const hint = isWaiting
    ? totalCount === 0
      ? 'ממתינים שהתלמידים יצטרפו… אפשר להתחיל ברגע שיש לפחות תלמיד/ה אחד/ת.'
      : `${totalCount} ${totalCount === 1 ? 'תלמיד/ה מחכה' : 'תלמידים מחכים'} – כשכולם בפנים, מתחילים.`
    : state === GameState.PAUSED
      ? 'המשחק מושהה. התלמידים רואים מסך המתנה עד שממשיכים.'
      : state === GameState.QUESTION_RESULTS && isTeacherPaced
        ? 'מוצגות התוצאות לשאלה – לחצו ״שאלה הבאה״ כדי להמשיך.'
        : state === GameState.COMPLETED
          ? 'המשחק הסתיים. אפשר לפתוח סבב חדש עם אותם תלמידים.'
          : null;

  return (
    <div>
      <PageHeader
        eyebrow="חדר חי"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {room.className}
            <StateBadge state={state} size="md" />
          </span>
        }
        subtitle={`${MODE_LABELS[room.mode].label} · ${questionCount} שאלות · קוד ${room.code}`}
        crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: room.className }]}
        actions={
          <>
            <span
              role="status"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset',
                socketConnected ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200',
              )}
              title={socketConnected ? 'מחובר לעדכונים בזמן אמת' : 'אין חיבור בזמן אמת'}
            >
              {socketConnected ? (
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              ) : (
                <WifiOff className="size-3.5" aria-hidden />
              )}
              {socketConnected ? 'זמן אמת' : 'לא מחובר'}
              {socketConnected && <Wifi className="size-3.5" aria-hidden />}
            </span>
            <Button variant="ghost" size="md" onClick={() => void loadLive(id)} disabled={liveLoading} aria-label="רענון">
              <RefreshCw className={cn('size-4', liveLoading && 'animate-spin')} aria-hidden />
            </Button>
            <Button variant="secondary" size="md" onClick={() => navigate(teacherPath(`rooms/${id}/results`))}>
              <BarChart3 className="size-4" aria-hidden />
              תוצאות
            </Button>
          </>
        }
      />

      {/* אזור חי לקוראי מסך – מצב המשחק ומוני תלמידים (בלי ניקוד, כדי לא להציף) */}
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {`${STATE_LABELS[state].label}. ${connectedCount} מחוברים מתוך ${totalCount}, ${live.finishedCount} סיימו.`}
      </p>

      {isEnded && (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200/80">
          <Ban className="size-4 shrink-0 text-slate-500" aria-hidden />
          החדר {state === GameState.CANCELLED ? 'בוטל' : 'פג תוקפו'} ואינו פעיל יותר. אפשר ליצור משחק חדש מלוח הבקרה.
        </div>
      )}

      {state === GameState.COMPLETED && (
        <motion.div
          role="status"
          initial={reduce ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex flex-col gap-3 rounded-2xl bg-linear-to-l from-emerald-50 to-teal-50 px-5 py-4 ring-1 ring-emerald-200/70 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-emerald-400 to-green-600 text-white shadow-lg shadow-emerald-500/40">
              <Trophy className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-extrabold text-brand-navy">המשחק הסתיים!</span>
              התוצאות וההישגים מוכנים לצפייה.
            </span>
          </div>
          <Button variant="success" size="md" onClick={() => navigate(teacherPath(`rooms/${id}/results`))}>
            <BarChart3 className="size-4" aria-hidden /> לתוצאות
          </Button>
        </motion.div>
      )}

      {/* ציר זמן */}
      <Card variant="glass" padding="none" className="mb-5 px-3 py-4 sm:px-8 sm:py-5">
        <Stepper
          steps={TIMELINE.map((s) => (s.key === 'questions' && state === GameState.PAUSED ? { ...s, tag: 'מושהה' } : s))}
          current={timeline}
          muted={isEnded}
          tone={timeline >= 4 ? 'green' : 'violet'}
          label="שלבי המשחק"
        />
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* קוד + QR */}
        <div className="relative lg:col-span-1">
          <div className="pointer-events-none absolute -inset-1 rounded-[2rem] bg-linear-to-br from-violet-400/40 via-sky-300/30 to-fuchsia-300/40 blur-xl" aria-hidden />
          <Card variant="glass" padding="none" className="relative flex h-full flex-col items-center gap-4 overflow-hidden p-5 sm:p-6">
            <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(139,92,246,.12)_1px,transparent_1px)] [background-size:18px_18px] opacity-60" aria-hidden />
            <div className="relative flex w-full flex-col items-center gap-4 md:flex-row md:items-center md:justify-around lg:flex-col">
              <div className="flex flex-col items-center gap-2">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">קוד החדר</div>
                <div className="flex items-center gap-2">
                  <motion.div
                    dir="ltr"
                    className="select-all whitespace-nowrap bg-linear-to-b from-brand-navy to-violet-700 bg-clip-text font-mono text-[2.5rem] font-black leading-none tracking-[0.12em] text-transparent drop-shadow-[0_8px_18px_rgba(139,92,246,.35)] sm:text-6xl lg:text-4xl xl:text-5xl"
                    aria-label={`קוד חדר ${room.code}`}
                    animate={reduce || !isWaiting ? undefined : { scale: [1, 1.02, 1] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {room.code}
                  </motion.div>
                  <button
                    type="button"
                    onClick={() => void copy(room.code, 'code')}
                    className="grid size-11 min-h-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-700"
                    aria-label="העתקת הקוד"
                    title="העתקת הקוד"
                  >
                    {copied === 'code' ? <Check className="size-5 text-brand-green" aria-hidden /> : <Copy className="size-5" aria-hidden />}
                  </button>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset',
                    room.joinOpen ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200',
                  )}
                >
                  {room.joinOpen ? <DoorOpen className="size-3.5" aria-hidden /> : <DoorClosed className="size-3.5" aria-hidden />}
                  {room.joinOpen ? 'ההצטרפות פתוחה' : 'ההצטרפות סגורה'}
                </span>
              </div>
              <div className="rounded-2xl bg-white p-3 shadow-[0_14px_30px_-16px_rgba(30,41,59,.4)] ring-1 ring-slate-100">
                <QRCodeSVG value={live.joinUrl} size={160} level="M" includeMargin={false} aria-label="QR להצטרפות" className="size-36 sm:size-40" />
              </div>
            </div>
            <div className="relative flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200/70">
              <Link2 className="size-4 shrink-0 text-slate-500" aria-hidden />
              <a href={live.joinUrl} target="_blank" rel="noreferrer" dir="ltr" className="-my-3.5 min-w-0 flex-1 truncate py-3.5 text-start font-medium hover:text-violet-700" aria-label={`קישור הצטרפות (נפתח בחלון חדש): ${live.joinUrl}`}>
                {live.joinUrl}
              </a>
              <button type="button" onClick={() => void copy(live.joinUrl, 'link')} className={cn('grid size-8 min-h-0 place-items-center rounded-lg hover:bg-white', HIT_AREA.sm)} aria-label="העתקת הקישור">
                {copied === 'link' ? <Check className="size-4 text-brand-green" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              </button>
            </div>
            <p className="relative text-center text-xs leading-5 text-slate-500">התלמידים סורקים את ה־QR מהטאבלט או מקלידים את הקוד במסך ההצטרפות.</p>
          </Card>
        </div>

        {/* מרכז שליטה */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel title="שליטה במשחק" description={hint ?? undefined} icon={<Play className="size-5" aria-hidden />} tone="navy">
            <div className="flex flex-col gap-4" role="group" aria-label="פעולות">
              <div className="flex flex-wrap items-center gap-3">
                {isWaiting && (
                  <MagicButton tone="green" size="lg" glow icon={<Play className="size-5" aria-hidden />} onClick={() => void act('start')} disabled={busy}>
                    התחל משחק
                  </MagicButton>
                )}
                {showNext && (
                  <MagicButton tone="violet" size="lg" glow icon={<SkipForward className="size-5" aria-hidden />} onClick={() => void act('next')} disabled={busy}>
                    שאלה הבאה
                  </MagicButton>
                )}
                {state === GameState.PAUSED && (
                  <MagicButton tone="green" size="lg" glow icon={<Play className="size-5" aria-hidden />} onClick={() => void act('resume')} disabled={busy}>
                    המשך
                  </MagicButton>
                )}
                {state === GameState.COMPLETED && (
                  <MagicButton tone="violet" size="lg" glow icon={<RotateCcw className="size-5" aria-hidden />} onClick={() => setConfirm('new-round')} disabled={busy}>
                    סבב חדש
                  </MagicButton>
                )}
                {(IN_PLAY.includes(state) || state === GameState.COUNTDOWN) && (
                  <Button variant="secondary" size="md" onClick={() => void act('pause')} disabled={busy} loading={pendingAction === 'pause'}>
                    <Pause className="size-5" aria-hidden /> השהה
                  </Button>
                )}
                {canFinish && (
                  <Button variant="danger" size="md" onClick={() => setConfirm('finish')} disabled={busy}>
                    <Flag className="size-5" aria-hidden /> סיים משחק
                  </Button>
                )}
                {busy && <Spinner size="sm" className="text-violet-700" label="מבצעים פעולה…" />}
              </div>
              {(canToggleJoin || canCancel) && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {canToggleJoin && (
                    <Button
                      variant="ghost"
                      size="md"
                      onClick={() => setJoinOpen(id, !room.joinOpen).catch((err) => toast.error(friendlyError(err)))}
                      disabled={busy}
                      loading={pendingAction === 'join-open'}
                      className="bg-white/70 ring-1 ring-slate-200/80"
                    >
                      {room.joinOpen ? <DoorClosed className="size-4" aria-hidden /> : <DoorOpen className="size-4" aria-hidden />}
                      {room.joinOpen ? 'סגור הצטרפות' : 'פתח הצטרפות'}
                    </Button>
                  )}
                  {canCancel && (
                    <Button variant="ghost" size="md" onClick={() => setConfirm('cancel')} disabled={busy} className="text-rose-600 hover:bg-rose-50">
                      <Ban className="size-4" aria-hidden /> בטל
                    </Button>
                  )}
                </div>
              )}
            </div>

            {isTeacherPaced && (IN_PLAY.includes(state) || state === GameState.PAUSED) && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-linear-to-l from-violet-500/10 to-fuchsia-500/5 px-4 py-3 text-sm ring-1 ring-violet-100">
                <span className="text-slate-600">שאלה נוכחית</span>
                <span className="text-3xl font-black text-violet-700 tabular-nums">{currentQuestionNumber || '—'}</span>
                <span className="text-slate-500">/ {questionCount}</span>
              </div>
            )}
          </Panel>

          <Card variant="glass" padding="none" className="p-5 sm:p-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Counter label="מחוברים" value={connectedCount} suffix={`מתוך ${totalCount}`} tone="navy" />
              <Counter label="סיימו" value={live.finishedCount} suffix={`מתוך ${totalCount}`} tone="green" />
              <Counter label="שאלות בסבב" value={questionCount} tone="violet" />
            </div>
            <div className="mt-5">
              <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-600">
                <span>התקדמות הסבב</span>
                <span className="tabular-nums">{roundProgress.label}</span>
              </div>
              <ProgressBar value={roundProgress.value} max={roundProgress.max} size="sm" color="rainbow" label="התקדמות הסבב" />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-5">
        {/* משתתפים */}
        <Panel
          className="lg:col-span-3"
          icon={<Users className="size-5" aria-hidden />}
          title={
            <>
              תלמידים <span className="text-slate-500">({totalCount})</span>
            </>
          }
          description={totalCount > 0 ? `${connectedCount} מחוברים · ${live.finishedCount} סיימו` : undefined}
        >
          {totalCount === 0 ? (
            <EmptyState title="עדיין אין תלמידים" description="ברגע שתלמיד/ה מצטרפים עם הקוד – הם יופיעו כאן." className="bg-transparent py-6" />
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.25rem,1fr))] gap-3" aria-label="רשימת תלמידים">
              <AnimatePresence initial={false}>
                {live.participants.map((p) => (
                  <motion.li
                    key={p.id}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  >
                    <ParticipantCard participant={p} questionCount={questionCount} removing={pendingAction === `remove:${p.id}`} onRemove={isEnded ? undefined : () => setConfirm({ remove: p })} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Panel>

        {/* דירוג חי */}
        <Panel className="lg:col-span-2" icon={<Trophy className="size-5" aria-hidden />} tone="green" title="דירוג חי" description={live.leaderboard.length > 0 ? 'מתעדכן עם כל תשובה' : undefined}>
          {live.leaderboard.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">הדירוג יופיע עם התשובות הראשונות.</p>
          ) : (
            <LiveLeaderboard entries={live.leaderboard} limit={8} />
          )}
        </Panel>
      </div>

      {/* אישורים */}
      <ConfirmModal
        open={confirm === 'finish'}
        onClose={() => setConfirm(null)}
        title="סיום המשחק"
        description="לסיים את המשחק עכשיו? תלמידים שלא סיימו יקבלו את התוצאות הנוכחיות שלהם, ויוענקו הישגים."
        confirmLabel="סיים משחק"
        onConfirm={() => act('finish')}
      />
      <ConfirmModal
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        title="ביטול החדר"
        description="לבטל את החדר? התלמידים ינותקו והמשחק לא יוכל להמשיך. הפעולה אינה הפיכה."
        confirmLabel="בטל חדר"
        onConfirm={() => act('cancel')}
      />
      <ConfirmModal
        open={confirm === 'new-round'}
        onClose={() => setConfirm(null)}
        title="סבב חדש"
        variant="primary"
        description="להתחיל סבב חדש עם אותם תלמידים ואותן הגדרות? הניקוד של הסבב הקודם נשמר בתוצאות, והסבב החדש מתחיל מאפס."
        confirmLabel="התחל סבב חדש"
        onConfirm={async () => {
          try {
            await newRound(id);
            toast.success('סבב חדש נפתח – התלמידים יכולים להתחיל');
          } catch (err) {
            toast.error(friendlyError(err, 'פתיחת סבב חדש נכשלה'));
            throw err;
          }
        }}
      />
      <ConfirmModal
        open={typeof confirm === 'object' && confirm !== null}
        onClose={() => setConfirm(null)}
        title="הסרת תלמיד/ה"
        description={
          typeof confirm === 'object' && confirm ? (
            <>
              להסיר את <b>{confirm.remove.displayName}</b> מהחדר? התלמיד/ה ינותק/תנותק ולא יוכל/תוכל להמשיך לשחק בסבב הזה.
            </>
          ) : null
        }
        confirmLabel="הסרה"
        onConfirm={async () => {
          if (typeof confirm !== 'object' || !confirm) return;
          try {
            await removeParticipant(id, confirm.remove.id);
            toast.success(`${confirm.remove.displayName} הוסר/ה מהחדר`);
          } catch (err) {
            toast.error(friendlyError(err, 'ההסרה נכשלה'));
            throw err;
          }
        }}
      />
    </div>
  );
}

const COUNTER_TONES = { navy: 'text-brand-navy', green: 'text-emerald-700', violet: 'text-violet-700' } as const;

/** מונה חי – ספירה מונפשת + "פעימה" עדינה בכל שינוי ערך. */
function Counter({ label, value, suffix, tone }: { label: string; value: number; suffix?: ReactNode; tone: keyof typeof COUNTER_TONES }) {
  const reduce = useReducedMotion();
  return (
    <div className="rounded-2xl bg-white/70 px-2 py-3 ring-1 ring-white/80">
      <div className="text-[11px] font-bold text-slate-600 sm:text-xs">{label}</div>
      <motion.div
        key={value}
        initial={reduce ? false : { scale: 1.18 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        className={cn('mt-0.5 text-2xl font-black leading-none tabular-nums sm:text-3xl', COUNTER_TONES[tone])}
      >
        <CountUp value={value} />
        {suffix && <span className="ms-1 whitespace-nowrap text-xs font-semibold text-slate-500 sm:text-sm">{suffix}</span>}
      </motion.div>
    </div>
  );
}

function ParticipantCard({ participant: p, questionCount, removing, onRemove }: { participant: ParticipantView; questionCount: number; removing: boolean; onRemove?: () => void }) {
  const reduce = useReducedMotion();
  const pct = questionCount ? Math.min(100, (p.answeredCount / questionCount) * 100) : 0;
  const status = p.finished ? 'סיים/ה' : p.connected ? 'מחובר/ת' : 'מנותק/ת';
  return (
    <div
      className={cn(
        'relative flex h-full min-w-0 flex-col items-center gap-2 rounded-2xl border px-2.5 pb-3 pt-4 text-center transition-[border-color,box-shadow,background-color]',
        p.finished
          ? 'border-emerald-200 bg-linear-to-b from-emerald-50 to-white shadow-[0_10px_24px_-16px_rgba(34,197,94,.6)]'
          : p.connected
            ? 'border-white/80 bg-white/85 shadow-[0_10px_24px_-18px_rgba(30,41,59,.4)]'
            : 'border-dashed border-slate-300 bg-slate-50/70',
      )}
      data-participant-id={p.id}
    >
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className={cn('absolute start-1.5 top-1.5 grid size-8 min-h-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50', HIT_AREA.sm)}
          aria-label={`הסרת ${p.displayName}`}
          title="הסרה מהחדר"
        >
          <UserMinus className="size-4" aria-hidden />
        </button>
      )}
      <div className="relative">
        <Avatar id={p.avatar} size="md" className={cn('ring-[3px]', p.finished ? 'ring-emerald-400' : p.connected ? 'ring-sky-300' : 'ring-slate-200 grayscale')} />
        <span
          className={cn(
            'absolute -bottom-0.5 -end-0.5 grid size-5 place-items-center rounded-full ring-2 ring-white',
            p.finished ? 'bg-emerald-500 text-white' : p.connected ? 'bg-emerald-500' : 'bg-slate-300',
          )}
          title={status}
          aria-label={status}
          role="img"
        >
          {p.finished && <Check className="size-3" strokeWidth={4} aria-hidden />}
        </span>
      </div>
      <div className="w-full min-w-0">
        <div className={cn('line-clamp-2 break-words text-sm font-extrabold leading-tight', p.connected || p.finished ? 'text-brand-navy' : 'text-slate-600')} title={p.displayName}>
          {p.displayName}
        </div>
        <div className="mt-1 text-[11px] text-slate-600 tabular-nums">
          {p.answeredCount}/{questionCount} שאלות
        </div>
      </div>
      <div className="mt-auto flex w-full items-center justify-between text-xs">
        <span className="text-slate-600">ניקוד</span>
        <span className="font-black text-violet-700 tabular-nums">{formatNumber(p.score)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner" role="progressbar" aria-label={`התקדמות ${p.displayName}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <motion.div
          className={cn('h-full rounded-full', p.finished ? 'bg-linear-to-l from-emerald-400 to-green-500' : 'bg-linear-to-l from-violet-500 to-fuchsia-400')}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 24 }}
        />
      </div>
    </div>
  );
}

// מבוסס על 21st.dev — Leaderboard Table (medal badges + delta chevrons) בגרסה קומפקטית עם motion layout.
function LiveLeaderboard({ entries, limit = 8 }: { entries: LeaderboardEntry[]; limit?: number }) {
  const reduce = useReducedMotion();
  const sorted = useMemo(() => [...entries].sort((a, b) => a.rank - b.rank || b.score - a.score).slice(0, limit), [entries, limit]);
  // "מצב נגזר": שומרים את הדירוג הקודם כדי להציג חיצי שינוי מיקום (ללא effect)
  const [snapshot, setSnapshot] = useState<{ entries: LeaderboardEntry[]; prevRanks: Map<string, number> }>({ entries, prevRanks: new Map() });
  if (snapshot.entries !== entries) {
    setSnapshot({ entries, prevRanks: new Map(snapshot.entries.map((e) => [e.participantId, e.rank])) });
  }
  const deltas = snapshot.prevRanks;
  const leader = sorted[0];

  return (
    <>
      {leader && (
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {`במקום הראשון: ${leader.displayName}, ${formatNumber(leader.score)} נקודות`}
        </p>
      )}
    <ol className="flex flex-col gap-1.5" aria-label="דירוג חי">
      <AnimatePresence initial={false}>
        {sorted.map((e) => {
          const medal = medalForRank(e.rank);
          const prevRank = deltas.get(e.participantId);
          const delta = prevRank === undefined ? 0 : prevRank - e.rank;
          return (
            <motion.li
              key={e.participantId}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className={cn(
                'flex items-center gap-2 rounded-2xl bg-white/85 px-2.5 py-1.5 shadow-sm ring-1 ring-black/5',
                e.rank === 1 && 'bg-linear-to-l from-amber-50 to-white ring-amber-200/70',
                !e.connected && 'opacity-60',
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-600 tabular-nums" aria-label={`מקום ${e.rank}`}>
                {medal ? <Medal kind={medal} size="sm" className="size-8" /> : e.rank}
              </span>
              <Avatar id={e.avatar} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-brand-navy" title={e.displayName}>{e.displayName}</span>
                <span className="block text-[11px] text-slate-500 tabular-nums">
                  {e.correctAnswers}/{e.answeredCount} נכונות
                </span>
              </span>
              <span
                className={cn('inline-flex items-center text-[11px] font-bold tabular-nums', delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-600' : 'text-slate-500')}
                aria-label={delta > 0 ? `עלה ${delta} מקומות` : delta < 0 ? `ירד ${-delta} מקומות` : 'ללא שינוי'}
              >
                {delta > 0 ? <ChevronUp className="size-3.5" aria-hidden /> : delta < 0 ? <ChevronDown className="size-3.5" aria-hidden /> : <Minus className="size-3" aria-hidden />}
                {delta !== 0 && Math.abs(delta)}
              </span>
              <span className="shrink-0 text-sm font-black text-violet-700 tabular-nums sm:text-base">{formatNumber(e.score)}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
    </>
  );
}

export default LiveRoomPage;
