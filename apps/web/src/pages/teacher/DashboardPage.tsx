import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  BarChart3,
  BookOpenText,
  CalendarClock,
  Eye,
  Images,
  Layers,
  ListChecks,
  PlusCircle,
  Radio,
  RefreshCw,
  Repeat,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { GameState, isPictureOnlySettings, type GameSummary } from '@oc/shared';
import { Button, Card, EmptyState, Spinner, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useTeacherStore } from '@/stores/teacherStore';
import { teacherApi, type StatsOverview } from '@/services/teacherApi';
import { ConfirmModal, MagicButton, PageHeader, SegmentedTabs, SpotlightOverlay, StatCard, StateBadge, TonePill, spotlightHandlers } from './components';
import { ACTIVE_STATES, ENDED_STATES, MODE_LABELS, formatDateTime, formatNumber, friendlyError, teacherPath } from './labels';

type Filter = 'all' | 'active' | 'ended';

const percent = (n: number) => `${Math.round(n)}%`;

export function DashboardPage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const games = useTeacherStore((s) => s.games);
  const gamesLoading = useTeacherStore((s) => s.gamesLoading);
  const gamesError = useTeacherStore((s) => s.gamesError);
  const loadGames = useTeacherStore((s) => s.loadGames);
  const deleteGame = useTeacherStore((s) => s.deleteGame);
  const profile = useTeacherStore((s) => s.profile);

  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [toDelete, setToDelete] = useState<GameSummary | null>(null);

  const fetchStats = useCallback(
    () =>
      teacherApi.games
        .statsOverview()
        .then(setStats)
        .catch((err: unknown) => toast.error(friendlyError(err, 'לא הצלחנו לטעון את הסטטיסטיקות')))
        .finally(() => setStatsLoading(false)),
    [],
  );

  useEffect(() => {
    void loadGames();
    void fetchStats();
  }, [loadGames, fetchStats]);

  const refresh = () => {
    setStatsLoading(true);
    void loadGames();
    void fetchStats();
  };

  const activeCount = games.filter((g) => !ENDED_STATES.includes(g.state)).length;
  const endedCount = games.length - activeCount;
  const filtered = games.filter((g) => {
    if (filter === 'active') return !ENDED_STATES.includes(g.state);
    if (filter === 'ended') return ENDED_STATES.includes(g.state);
    return true;
  });

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteGame(toDelete.roomId);
      toast.success(`החדר ${toDelete.code} נמחק`);
      void fetchStats();
    } catch (err) {
      toast.error(friendlyError(err, 'מחיקת החדר נכשלה'));
      throw err;
    }
  };

  const firstName = profile?.name?.trim().split(/\s+/)[0];
  const hour = new Date().getHours();
  const dayPart = hour < 12 ? 'בוקר טוב' : hour < 17 ? 'צהריים טובים' : 'ערב טוב';

  return (
    <div>
      <PageHeader
        eyebrow={dayPart}
        title={firstName ? `שלום, ${firstName}` : 'שלום'}
        subtitle="כאן מנהלים משחקים, עוקבים אחרי הכיתה בזמן אמת וצופים בתוצאות."
        crumbs={[{ label: 'לוח בקרה' }]}
        actions={
          <>
            <Button variant="ghost" size="md" onClick={refresh} disabled={gamesLoading} aria-label="רענון הנתונים">
              <RefreshCw className={cn('size-4', gamesLoading && 'animate-spin')} aria-hidden />
              <span className="hidden sm:inline">רענון</span>
            </Button>
            <Button variant="secondary" size="md" onClick={() => navigate(teacherPath('content'))}>
              <BookOpenText className="size-4" aria-hidden />
              מאגר ההפכים
            </Button>
          </>
        }
      />

      {/* כרטיסי סטטיסטיקה */}
      <section aria-label="סטטיסטיקות" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="חדרים פעילים" value={stats?.activeRooms} icon={Activity} tone="green" loading={statsLoading} delay={0} />
        <StatCard label="סבבי משחק" value={stats?.totalSessions} icon={Layers} tone="violet" loading={statsLoading} delay={0.06} />
        <StatCard label="תלמידים שהשתתפו" value={stats?.totalParticipants} icon={Users} tone="sky" loading={statsLoading} delay={0.12} />
        <StatCard label="דיוק ממוצע" value={stats?.averageAccuracy} format={percent} icon={Target} tone="orange" loading={statsLoading} delay={0.18} />
      </section>

      {/* CTA */}
      <motion.section
        className="mt-5 sm:mt-6"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.2 }}
      >
        <div className="relative overflow-hidden rounded-[1.75rem] bg-linear-to-l from-violet-600 via-violet-700 to-brand-navy p-6 text-white shadow-[0_30px_60px_-28px_rgba(88,28,135,.8)] ring-1 ring-white/10 sm:p-8">
          <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:18px_18px] opacity-40" aria-hidden />
          <div className="pointer-events-none absolute -left-10 -top-16 size-64 rounded-full bg-brand-yellow/15 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -bottom-24 right-1/3 size-56 rounded-full bg-brand-pink/15 blur-3xl" aria-hidden />
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4 sm:items-center">
              <motion.img
                src="/images/characters/sun.svg"
                alt=""
                className="size-20 shrink-0 drop-shadow-[0_12px_20px_rgba(0,0,0,.35)] sm:size-28"
                animate={reduce ? undefined : { y: [0, -8, 0], rotate: [0, 4, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-yellow-200">מתחילים?</div>
                <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">משחק חדש לכיתה</h2>
                <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/90">בוחרים קטגוריות, רמת קושי וסוגי שאלות – ותוך דקה הכיתה מצטרפת עם קוד בן 6 ספרות או סריקת QR.</p>
              </div>
            </div>
            <MagicButton tone="yellow" size="xl" glow fullWidth className="sm:w-auto" icon={<PlusCircle className="size-6" aria-hidden />} onClick={() => navigate(teacherPath('new'))}>
              משחק חדש
            </MagicButton>
          </div>
        </div>
      </motion.section>

      {/* רשימת חדרים */}
      <section className="mt-7 sm:mt-8" aria-label="החדרים שלי">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-brand-navy">
            <Radio className="size-5 text-violet-700" aria-hidden />
            החדרים שלי
            {games.length > 0 && <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-xs font-bold text-slate-600 tabular-nums">{games.length}</span>}
          </h2>
          <SegmentedTabs
            label="סינון חדרים"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'הכול' },
              { value: 'active', label: 'פעילים', count: activeCount },
              { value: 'ended', label: 'הסתיימו', count: endedCount },
            ]}
          />
        </div>

        {gamesError && (
          <div role="alert" className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
            {gamesError}
          </div>
        )}

        {gamesLoading && games.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner className="text-violet-700" />
          </div>
        ) : filtered.length === 0 ? (
          <Card variant="glass" padding="none" className="p-4 sm:p-8">
            <EmptyState
              title={games.length === 0 ? 'עדיין אין חדרים' : 'אין חדרים בסינון הזה'}
              description={games.length === 0 ? 'צרו את המשחק הראשון שלכם והזמינו את הכיתה להצטרף.' : 'נסו סינון אחר, או צרו משחק חדש.'}
              className="bg-transparent"
              action={
                games.length === 0 ? (
                  <Button variant="primary" size="md" onClick={() => navigate(teacherPath('new'))}>
                    <PlusCircle className="size-5" aria-hidden />
                    יצירת משחק ראשון
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <ul className="grid gap-3">
            {filtered.map((g, i) => (
              <motion.li
                key={g.roomId}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(i, 6) * 0.04 }}
              >
                <RoomRow game={g} onDelete={() => setToDelete(g)} />
              </motion.li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="מחיקת חדר"
        description={
          <>
            למחוק את החדר <b dir="ltr">{toDelete?.code}</b> של כיתה <b>{toDelete?.className}</b>? כל נתוני התלמידים והתוצאות של החדר יימחקו לצמיתות.
          </>
        }
        confirmLabel="מחיקה"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function RoomRow({ game, onDelete }: { game: GameSummary; onDelete: () => void }) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const isLive = ACTIVE_STATES.includes(game.state) || game.state === GameState.WAITING_FOR_PLAYERS;
  const hasResults = game.sessionCount > 0 && game.state !== GameState.WAITING_FOR_PLAYERS && game.state !== GameState.CREATED;
  return (
    <motion.div whileHover={reduce ? undefined : { y: -3 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
      <Card
        variant="glass"
        padding="none"
        className={cn(
          'group relative flex flex-col gap-4 overflow-hidden p-4 transition-shadow hover:shadow-[0_24px_40px_-24px_rgba(30,41,59,.4)] sm:flex-row sm:items-center sm:justify-between sm:p-5',
          isLive && 'ring-1 ring-violet-200/70',
        )}
        {...spotlightHandlers()}
      >
        <SpotlightOverlay />
        {isLive && <span className="absolute inset-y-0 start-0 w-1 bg-linear-to-b from-violet-500 to-fuchsia-500" aria-hidden />}
        <div className="relative flex min-w-0 items-center gap-4">
          <div
            dir="ltr"
            className={cn(
              'relative grid shrink-0 place-items-center rounded-2xl px-3 py-2 font-mono text-lg font-black tracking-[0.18em] shadow-inner sm:text-xl',
              isLive ? 'bg-linear-to-br from-violet-500/15 to-fuchsia-500/10 text-violet-700 ring-1 ring-violet-200' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/70',
            )}
            aria-label={`קוד ${game.code}`}
          >
            {game.code}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-extrabold tracking-tight text-brand-navy">{game.className}</h3>
              <StateBadge state={game.state} />
              {isPictureOnlySettings(game.settings) && (
                <TonePill tone="pink" icon={<Images className="size-3" aria-hidden />}>
                  ללא קריאה
                </TonePill>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                {formatNumber(game.participantCount)} תלמידים
              </span>
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3.5" aria-hidden />
                {MODE_LABELS[game.mode].label}
              </span>
              <span className="inline-flex items-center gap-1">
                <ListChecks className="size-3.5" aria-hidden />
                {game.settings.questionCount} שאלות · {game.sessionCount === 1 ? 'סבב אחד' : `${game.sessionCount} סבבים`}
              </span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <CalendarClock className="size-3.5" aria-hidden />
                {formatDateTime(game.createdAt)}
              </span>
            </div>
          </div>
        </div>
        <div className="relative flex items-center gap-2 sm:shrink-0 sm:justify-end">
          <Button variant={isLive ? 'primary' : 'secondary'} size="md" className="flex-1 sm:flex-none" onClick={() => navigate(teacherPath(`rooms/${game.roomId}`))} aria-label={`${isLive ? 'חדר חי' : 'פתיחה'}: ${game.className}`}>
            <Eye className="size-4" aria-hidden />
            {isLive ? 'חדר חי' : 'פתיחה'}
          </Button>
          {hasResults && (
            <Button variant="ghost" size="md" onClick={() => navigate(teacherPath(`rooms/${game.roomId}/results`))} aria-label={`תוצאות: ${game.className}`}>
              <BarChart3 className="size-4" aria-hidden />
              תוצאות
            </Button>
          )}
          <button
            type="button"
            onClick={onDelete}
            aria-label={`מחיקת חדר ${game.code}`}
            title="מחיקת החדר"
            className="grid size-11 min-h-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="size-[18px]" aria-hidden />
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

export default DashboardPage;
