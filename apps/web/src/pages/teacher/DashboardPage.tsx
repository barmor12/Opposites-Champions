import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Activity,
  BarChart3,
  BookOpenText,
  Eye,
  Layers,
  PlusCircle,
  RefreshCw,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { GameState, type GameSummary } from '@oc/shared';
import { Button, Card, EmptyState, Spinner, toast } from '@/components/ui';
import { useTeacherStore } from '@/stores/teacherStore';
import { teacherApi, type StatsOverview } from '@/services/teacherApi';
import { ConfirmModal, PageHeader, StatCard, StateBadge } from './components';
import { ACTIVE_STATES, ENDED_STATES, MODE_LABELS, formatDateTime, formatNumber, formatPercent, friendlyError, teacherPath } from './labels';

type Filter = 'all' | 'active' | 'ended';

export function DashboardPage() {
  const navigate = useNavigate();
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

  const greeting = profile?.name ? `שלום, ${profile.name.split(' ')[0]}` : 'שלום';

  return (
    <div>
      <PageHeader
        title={greeting}
        subtitle="כאן מנהלים משחקים, עוקבים אחרי הכיתה בזמן אמת וצופים בתוצאות."
        actions={
          <>
            <Button variant="ghost" onClick={refresh} disabled={gamesLoading}>
              <RefreshCw className={`h-4 w-4 ${gamesLoading ? 'animate-spin' : ''}`} aria-hidden />
              רענון
            </Button>
            <Link to={teacherPath('content')}>
              <Button variant="secondary">
                <BookOpenText className="h-4 w-4" aria-hidden />
                מאגר ההפכים
              </Button>
            </Link>
          </>
        }
      />

      {/* כרטיסי סטטיסטיקה */}
      <section aria-label="סטטיסטיקות" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="חדרים פעילים" value={formatNumber(stats?.activeRooms)} icon={Activity} tone="green" loading={statsLoading} />
        <StatCard label="סבבי משחק" value={formatNumber(stats?.totalSessions)} icon={Layers} tone="violet" loading={statsLoading} />
        <StatCard label="תלמידים שהשתתפו" value={formatNumber(stats?.totalParticipants)} icon={Users} tone="sky" loading={statsLoading} />
        <StatCard label="דיוק ממוצע" value={formatPercent(stats?.averageAccuracy)} icon={Target} tone="orange" loading={statsLoading} />
      </section>

      {/* CTA */}
      <section className="mt-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-brand-violet to-brand-navy p-6 text-white shadow-lg sm:p-8">
          <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold">מתחילים משחק חדש?</h2>
              <p className="mt-1 max-w-xl text-sm text-white/80">
                בוחרים קטגוריות, רמת קושי וסוגי שאלות – ותוך דקה הכיתה מצטרפת עם קוד בן 6 ספרות.
              </p>
            </div>
            <Button variant="success" size="xl" onClick={() => navigate(teacherPath('new'))}>
              <PlusCircle className="h-6 w-6" aria-hidden />
              משחק חדש
            </Button>
          </div>
          <div className="pointer-events-none absolute -left-10 -top-10 h-48 w-48 rounded-full bg-brand-yellow/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-brand-pink/30 blur-2xl" />
        </div>
      </section>

      {/* רשימת חדרים */}
      <section className="mt-8" aria-label="החדרים שלי">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-brand-navy">החדרים שלי</h2>
          <div role="tablist" aria-label="סינון חדרים" className="flex rounded-full bg-slate-100 p-1 text-sm">
            {(
              [
                ['all', 'הכול'],
                ['active', 'פעילים'],
                ['ended', 'הסתיימו'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={filter === key}
                onClick={() => setFilter(key)}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  filter === key ? 'bg-white text-brand-navy shadow-sm' : 'text-slate-500 hover:text-brand-navy'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {gamesError && (
          <div role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {gamesError}
          </div>
        )}

        {gamesLoading && games.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <Card padding="none" className="p-8">
            <EmptyState
              title={games.length === 0 ? 'עדיין אין חדרים' : 'אין חדרים בסינון הזה'}
              description={games.length === 0 ? 'צרו את המשחק הראשון שלכם והזמינו את הכיתה להצטרף.' : 'נסו סינון אחר.'}
            />
          </Card>
        ) : (
          <ul className="grid gap-3">
            {filtered.map((g) => (
              <li key={g.roomId}>
                <RoomRow game={g} onDelete={() => setToDelete(g)} />
              </li>
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
            למחוק את החדר <b dir="ltr">{toDelete?.code}</b> של כיתה <b>{toDelete?.className}</b>? כל נתוני התלמידים והתוצאות של
            החדר יימחקו לצמיתות.
          </>
        }
        confirmLabel="מחיקה"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function RoomRow({ game, onDelete }: { game: GameSummary; onDelete: () => void }) {
  const isLive = ACTIVE_STATES.includes(game.state) || game.state === GameState.WAITING_FOR_PLAYERS;
  const hasResults = game.sessionCount > 0 && game.state !== GameState.WAITING_FOR_PLAYERS && game.state !== GameState.CREATED;
  return (
    <Card padding="none" className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div
          dir="ltr"
          className={`shrink-0 rounded-2xl px-3 py-2 font-mono text-xl font-bold tracking-[0.2em] ${
            isLive ? 'bg-brand-violet/10 text-brand-violet' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {game.code}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-brand-navy">{game.className}</h3>
            <StateBadge state={game.state} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {formatNumber(game.participantCount)} משתתפים
            </span>
            <span>{MODE_LABELS[game.mode].label}</span>
            <span>{game.settings.questionCount} שאלות</span>
            <span>
              {game.sessionCount} {game.sessionCount === 1 ? 'סבב' : 'סבבים'}
            </span>
            <span>נוצר {formatDateTime(game.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Link to={teacherPath(`rooms/${game.roomId}`)}>
          <Button variant={isLive ? 'primary' : 'secondary'} size="md">
            <Eye className="h-4 w-4" aria-hidden />
            {isLive ? 'חדר חי' : 'פתיחה'}
          </Button>
        </Link>
        {hasResults && (
          <Link to={teacherPath(`rooms/${game.roomId}/results`)}>
            <Button variant="ghost" size="md">
              <BarChart3 className="h-4 w-4" aria-hidden />
              תוצאות
            </Button>
          </Link>
        )}
        <Button variant="ghost" size="md" onClick={onDelete} aria-label={`מחיקת חדר ${game.code}`}>
          <Trash2 className="h-4 w-4 text-red-500" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}

export default DashboardPage;
