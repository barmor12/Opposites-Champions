import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  BarChart3,
  Ban,
  Check,
  Copy,
  DoorClosed,
  DoorOpen,
  Flag,
  Link2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  UserMinus,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { GameMode, GameState, type ParticipantView } from '@oc/shared';
import { Avatar, Button, Card, EmptyState, ProgressBar, Spinner, toast } from '@/components/ui';
import { Leaderboard } from '@/components/Leaderboard';
import { useTeacherStore, type LiveEvent, type RoomAction } from '@/stores/teacherStore';
import { ConfirmModal, PageHeader, StateBadge } from './components';
import { MODE_LABELS, formatNumber, friendlyError, teacherPath } from './labels';

/** אחרי כמות זו של הודעות על תלמידים – משתיקים כדי לא להציף. */
const PLAYER_TOAST_LIMIT = 40;

type Confirm = 'finish' | 'cancel' | 'new-round' | { remove: ParticipantView } | null;

const IN_PLAY: readonly GameState[] = [GameState.QUESTION_ACTIVE, GameState.QUESTION_RESULTS, GameState.NEXT_QUESTION];

export function LiveRoomPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
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
        <Card padding="none" className="p-8">
          <EmptyState title="לא הצלחנו לטעון את החדר" description={liveError} />
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => void loadLive(id)}>
              <RefreshCw className="h-4 w-4" aria-hidden /> ניסיון נוסף
            </Button>
            <Button variant="ghost" onClick={() => navigate(teacherPath())}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> ללוח הבקרה
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!live || !room || !state) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
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

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {room.className}
            <StateBadge state={state} size="md" />
          </span>
        }
        subtitle={`${MODE_LABELS[room.mode].label} · ${questionCount} שאלות`}
        crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: room.className }]}
        actions={
          <>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                socketConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
              }`}
              title={socketConnected ? 'מחובר לעדכונים בזמן אמת' : 'אין חיבור בזמן אמת'}
            >
              {socketConnected ? <Wifi className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}
              {socketConnected ? 'זמן אמת' : 'לא מחובר'}
            </span>
            <Button variant="ghost" onClick={() => void loadLive(id)} disabled={liveLoading} aria-label="רענון">
              <RefreshCw className={`h-4 w-4 ${liveLoading ? 'animate-spin' : ''}`} aria-hidden />
            </Button>
            <Link to={teacherPath(`rooms/${id}/results`)}>
              <Button variant="secondary">
                <BarChart3 className="h-4 w-4" aria-hidden />
                תוצאות
              </Button>
            </Link>
          </>
        }
      />

      {isEnded && (
        <div role="status" className="mb-6 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          החדר {state === GameState.CANCELLED ? 'בוטל' : 'פג תוקפו'} ואינו פעיל יותר. אפשר ליצור משחק חדש מלוח הבקרה.
        </div>
      )}

      {state === GameState.COMPLETED && (
        <div role="status" className="mb-6 flex flex-col gap-3 rounded-2xl bg-brand-green/10 px-5 py-4 ring-1 ring-brand-green/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-700">
            <span className="font-bold text-brand-navy">המשחק הסתיים.</span> התוצאות וההישגים מוכנים לצפייה.
          </div>
          <div className="flex gap-2">
            <Link to={teacherPath(`rooms/${id}/results`)}>
              <Button variant="success">
                <BarChart3 className="h-4 w-4" aria-hidden /> לתוצאות
              </Button>
            </Link>
            <Button variant="primary" onClick={() => setConfirm('new-round')} disabled={busy}>
              <RotateCcw className="h-4 w-4" aria-hidden /> סבב חדש
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* קוד + QR */}
        <Card padding="none" className="flex flex-col items-center gap-4 p-6 lg:col-span-1">
          <div className="text-sm font-medium text-slate-500">קוד החדר</div>
          <div className="flex items-center gap-3">
            <div dir="ltr" className="select-all font-mono text-5xl font-black tracking-[0.25em] text-brand-navy sm:text-6xl" aria-label={`קוד חדר ${room.code}`}>
              {room.code}
            </div>
            <button
              type="button"
              onClick={() => void copy(room.code, 'code')}
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-violet"
              aria-label="העתקת הקוד"
              title="העתקת הקוד"
            >
              {copied === 'code' ? <Check className="h-5 w-5 text-brand-green" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-100">
            <QRCodeSVG value={live.joinUrl} size={168} level="M" includeMargin={false} aria-label="QR להצטרפות" />
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <Link2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <a href={live.joinUrl} target="_blank" rel="noreferrer" dir="ltr" className="min-w-0 flex-1 truncate text-left hover:text-brand-violet">
              {live.joinUrl}
            </a>
            <button type="button" onClick={() => void copy(live.joinUrl, 'link')} className="rounded-lg p-1 hover:bg-white" aria-label="העתקת הקישור">
              {copied === 'link' ? <Check className="h-4 w-4 text-brand-green" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-center text-xs text-slate-400">התלמידים סורקים את ה־QR מהטאבלט או מקלידים את הקוד במסך ההצטרפות.</p>
          <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${room.joinOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {room.joinOpen ? <DoorOpen className="h-3.5 w-3.5" aria-hidden /> : <DoorClosed className="h-3.5 w-3.5" aria-hidden />}
            {room.joinOpen ? 'ההצטרפות פתוחה' : 'ההצטרפות סגורה'}
          </div>
        </Card>

        {/* שליטה + מונים */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card padding="none" className="p-6">
            <h2 className="mb-4 text-base font-bold text-brand-navy">שליטה במשחק</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="פעולות">
              {isWaiting && (
                <Button variant="success" size="lg" onClick={() => void act('start')} disabled={busy} loading={pendingAction === 'start'}>
                  <Play className="h-5 w-5" aria-hidden /> התחל משחק
                </Button>
              )}
              {(IN_PLAY.includes(state) || state === GameState.COUNTDOWN) && (
                <Button variant="secondary" size="lg" onClick={() => void act('pause')} disabled={busy} loading={pendingAction === 'pause'}>
                  <Pause className="h-5 w-5" aria-hidden /> השהה
                </Button>
              )}
              {state === GameState.PAUSED && (
                <Button variant="success" size="lg" onClick={() => void act('resume')} disabled={busy} loading={pendingAction === 'resume'}>
                  <Play className="h-5 w-5" aria-hidden /> המשך
                </Button>
              )}
              {showNext && (
                <Button variant="primary" size="lg" onClick={() => void act('next')} disabled={busy} loading={pendingAction === 'next'}>
                  <SkipForward className="h-5 w-5" aria-hidden /> שאלה הבאה
                </Button>
              )}
              {canFinish && (
                <Button variant="danger" size="lg" onClick={() => setConfirm('finish')} disabled={busy}>
                  <Flag className="h-5 w-5" aria-hidden /> סיים משחק
                </Button>
              )}
              {state === GameState.COMPLETED && (
                <Button variant="primary" size="lg" onClick={() => setConfirm('new-round')} disabled={busy} loading={pendingAction === 'new-round'}>
                  <RotateCcw className="h-5 w-5" aria-hidden /> סבב חדש
                </Button>
              )}
              {canToggleJoin && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={() => setJoinOpen(id, !room.joinOpen).catch((err) => toast.error(friendlyError(err)))}
                  disabled={busy}
                  loading={pendingAction === 'join-open'}
                  aria-pressed={room.joinOpen}
                >
                  {room.joinOpen ? <DoorClosed className="h-5 w-5" aria-hidden /> : <DoorOpen className="h-5 w-5" aria-hidden />}
                  {room.joinOpen ? 'סגור הצטרפות' : 'פתח הצטרפות'}
                </Button>
              )}
              {canCancel && (
                <Button variant="ghost" size="lg" onClick={() => setConfirm('cancel')} disabled={busy}>
                  <Ban className="h-5 w-5 text-red-500" aria-hidden /> בטל
                </Button>
              )}
            </div>

            {isWaiting && totalCount === 0 && (
              <p className="mt-3 text-sm text-slate-500">ממתינים שהתלמידים יצטרפו… אפשר להתחיל ברגע שיש לפחות משתתף אחד.</p>
            )}
            {isTeacherPaced && (IN_PLAY.includes(state) || state === GameState.PAUSED) && (
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-brand-violet/5 px-4 py-3 text-sm">
                <span className="text-slate-500">שאלה נוכחית</span>
                <span className="text-2xl font-black text-brand-violet tabular-nums">
                  {(live.currentQuestionIndex ?? room.currentQuestionIndex ?? -1) + 1 || '—'}
                </span>
                <span className="text-slate-400">/ {questionCount}</span>
                {state === GameState.QUESTION_RESULTS && <span className="mr-auto text-xs text-slate-500">מוצגות התוצאות – לחצו ״שאלה הבאה״ להמשך</span>}
              </div>
            )}
          </Card>

          <Card padding="none" className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-slate-500">מחוברים</div>
                <div className="text-2xl font-bold text-brand-navy tabular-nums">
                  {connectedCount}
                  <span className="text-sm font-normal text-slate-400"> / {totalCount}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">סיימו</div>
                <div className="text-2xl font-bold text-brand-green tabular-nums">
                  {live.finishedCount}
                  <span className="text-sm font-normal text-slate-400"> מתוך {totalCount}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">שאלות בסבב</div>
                <div className="text-2xl font-bold text-brand-navy tabular-nums">{questionCount}</div>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>התקדמות הסבב</span>
                <span>{roundProgress.label}</span>
              </div>
              <ProgressBar value={roundProgress.value} max={roundProgress.max} />
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* משתתפים */}
        <Card padding="none" className="p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-base font-bold text-brand-navy">
              <Users className="h-5 w-5 text-brand-violet" aria-hidden />
              משתתפים ({totalCount})
            </h2>
          </div>
          {totalCount === 0 ? (
            <EmptyState title="עדיין אין משתתפים" description="ברגע שתלמיד מצטרף עם הקוד – הוא יופיע כאן." />
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" aria-label="רשימת משתתפים">
              <AnimatePresence initial={false}>
                {live.participants.map((p) => (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.18 }}
                  >
                    <ParticipantCard
                      participant={p}
                      questionCount={questionCount}
                      removing={pendingAction === `remove:${p.id}`}
                      onRemove={isEnded ? undefined : () => setConfirm({ remove: p })}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>

        {/* דירוג חי */}
        <Card padding="none" className="p-6">
          <h2 className="mb-4 text-base font-bold text-brand-navy">דירוג חי</h2>
          {live.leaderboard.length === 0 ? (
            <p className="text-sm text-slate-400">הדירוג יופיע עם התשובות הראשונות.</p>
          ) : (
            <Leaderboard entries={live.leaderboard} compact />
          )}
        </Card>
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
        description="להתחיל סבב חדש עם אותם משתתפים ואותן הגדרות? הניקוד של הסבב הקודם נשמר בתוצאות, והסבב החדש מתחיל מאפס."
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

function ParticipantCard({
  participant: p,
  questionCount,
  removing,
  onRemove,
}: {
  participant: ParticipantView;
  questionCount: number;
  removing: boolean;
  onRemove?: () => void;
}) {
  return (
    <div
      className={`relative flex flex-col gap-2 rounded-2xl border p-3 transition-colors ${
        p.finished ? 'border-brand-green/40 bg-brand-green/5' : p.connected ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50 opacity-70'
      }`}
      data-participant-id={p.id}
    >
      <div className="flex items-center gap-2">
        <div className="relative shrink-0">
          <Avatar id={p.avatar} size="sm" />
          <span
            className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full ring-2 ring-white ${p.connected ? 'bg-emerald-500' : 'bg-slate-300'}`}
            title={p.connected ? 'מחובר/ת' : 'מנותק/ת'}
            aria-label={p.connected ? 'מחובר/ת' : 'מנותק/ת'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-sm font-semibold text-brand-navy">{p.displayName}</span>
            {p.finished && <Check className="h-4 w-4 shrink-0 text-brand-green" aria-label="סיים/ה" />}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            {p.answeredCount}/{questionCount} שאלות
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label={`הסרת ${p.displayName}`}
            title="הסרה מהחדר"
          >
            <UserMinus className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">ניקוד</span>
        <span className="font-bold text-brand-violet tabular-nums">{formatNumber(p.score)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${p.finished ? 'bg-brand-green' : 'bg-brand-violet'}`}
          style={{ width: `${questionCount ? Math.min(100, (p.answeredCount / questionCount) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}

export default LiveRoomPage;
