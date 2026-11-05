import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowRight, Check, ChevronDown, Download, FileSpreadsheet, FileText, Target, Trophy, Users, X } from 'lucide-react';
import {
  ACHIEVEMENT_LABELS,
  QUESTION_TYPE_LABELS,
  type AchievementType,
  type GameResults,
  type GameSummary,
  type LeaderboardEntry,
  type QuestionStat,
} from '@oc/shared';
import { Avatar, Button, Card, EmptyState, Medal, Spinner, medalForRank, toast } from '@/components/ui';
import { Leaderboard } from '@/components/Leaderboard';
import { teacherApi, type ExportFormat } from '@/services/teacherApi';
import { useTeacherStore } from '@/stores/teacherStore';
import { PageHeader, StatCard, StateBadge } from './components';
import { formatDateTime, formatNumber, formatPercent, friendlyError, teacherPath } from './labels';

/** מזהה סבב = מזהה GameSession. ה־API מחזיר רק את הסבב הנוכחי/אחרון כברירת מחדל. */
export function ResultsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const games = useTeacherStore((s) => s.games);
  const loadGames = useTeacherStore((s) => s.loadGames);

  const [results, setResults] = useState<GameResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [knownSessions, setKnownSessions] = useState<Array<{ id: string; label: string }>>([]);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const summary: GameSummary | undefined = games.find((g) => g.roomId === id);

  useEffect(() => {
    if (games.length === 0) void loadGames();
  }, [games.length, loadGames]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    teacherApi.games
      .results(id, sessionId)
      .then((r) => {
        if (cancelled) return;
        setResults(r);
        setKnownSessions((prev) => {
          if (prev.some((s) => s.id === r.gameSessionId)) return prev;
          const label = r.startedAt ? `סבב מ־${formatDateTime(r.startedAt)}` : 'הסבב הנוכחי';
          return [...prev, { id: r.gameSessionId, label }];
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(friendlyError(err, 'לא הצלחנו לטעון את התוצאות'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, sessionId]);

  const achievementsByParticipant = useMemo(() => {
    const map = new Map<string, AchievementType[]>();
    for (const a of results?.achievements ?? []) {
      const list = map.get(a.participantId) ?? [];
      list.push(a.type);
      map.set(a.participantId, list);
    }
    return map;
  }, [results]);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      await teacherApi.games.export(id, format, results?.gameSessionId ?? sessionId);
      toast.success(format === 'csv' ? 'קובץ CSV ירד בהצלחה' : 'קובץ Excel ירד בהצלחה');
    } catch (err) {
      toast.error(friendlyError(err, 'הייצוא נכשל'));
    } finally {
      setExporting(null);
    }
  };

  const sessionCount = summary?.sessionCount ?? knownSessions.length;

  return (
    <div>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            תוצאות – {results?.className ?? summary?.className ?? 'חדר'}
            {results && <StateBadge state={results.state} size="md" />}
          </span>
        }
        subtitle={results?.startedAt ? `התחיל ${formatDateTime(results.startedAt)}${results.finishedAt ? ` · הסתיים ${formatDateTime(results.finishedAt)}` : ''}` : undefined}
        crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: summary?.className ?? 'חדר', to: teacherPath(`rooms/${id}`) }, { label: 'תוצאות' }]}
        actions={
          <>
            <Link to={teacherPath(`rooms/${id}`)}>
              <Button variant="ghost">
                <ArrowRight className="h-4 w-4" aria-hidden /> לחדר
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => void handleExport('csv')} loading={exporting === 'csv'} disabled={exporting !== null || !results}>
              <FileText className="h-4 w-4" aria-hidden /> CSV
            </Button>
            <Button variant="primary" onClick={() => void handleExport('xlsx')} loading={exporting === 'xlsx'} disabled={exporting !== null || !results}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden /> Excel
            </Button>
          </>
        }
      />

      {/* בחירת סבב */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label htmlFor="session-select" className="text-sm font-medium text-slate-600">
          סבב:
        </label>
        <div className="relative">
          <select
            id="session-select"
            value={sessionId ?? results?.gameSessionId ?? ''}
            onChange={(e) => setSessionId(e.target.value || undefined)}
            className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-brand-navy focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30"
          >
            {knownSessions.length === 0 && <option value="">הסבב האחרון</option>}
            {knownSessions.map((s, i) => (
              <option key={s.id} value={s.id}>
                {knownSessions.length > 1 ? `${i + 1}. ` : ''}
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        </div>
        {sessionCount > 1 && (
          <span className="text-xs text-slate-400">בחדר זה התקיימו {sessionCount} סבבים · מוצג הסבב האחרון כברירת מחדל</span>
        )}
      </div>

      {error && (
        <Card padding="none" className="p-8">
          <EmptyState title="לא הצלחנו לטעון את התוצאות" description={error} />
        </Card>
      )}

      {loading && !results && (
        <div className="flex justify-center py-24">
          <Spinner />
        </div>
      )}

      {results && (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="סיכום">
            <StatCard label="ממוצע כיתתי" value={formatNumber(Math.round(results.classAverage))} hint="נקודות לתלמיד" icon={Trophy} tone="yellow" />
            <StatCard label="דיוק כיתתי" value={formatPercent(results.classAccuracy)} icon={Target} tone="green" />
            <StatCard label="תלמידים" value={formatNumber(results.leaderboard.length)} icon={Users} tone="sky" />
            <StatCard label="שאלות" value={formatNumber(results.questionCount)} icon={FileText} tone="violet" />
          </section>

          {results.leaderboard.length === 0 ? (
            <Card padding="none" className="mt-6 p-8">
              <EmptyState title="אין עדיין תוצאות" description="כשהתלמידים יתחילו לענות – התוצאות יופיעו כאן." />
            </Card>
          ) : (
            <>
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <Card padding="none" className="p-6 lg:col-span-1">
                  <h2 className="mb-4 text-base font-bold text-brand-navy">הפודיום</h2>
                  <Leaderboard entries={results.leaderboard.slice(0, 10)} showPodium compact />
                </Card>

                <Card padding="none" className="overflow-hidden p-0 lg:col-span-2">
                  <div className="border-b border-slate-100 px-6 py-4">
                    <h2 className="text-base font-bold text-brand-navy">כל התלמידים</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                          <th className="px-4 py-2 text-right font-medium">#</th>
                          <th className="px-4 py-2 text-right font-medium">תלמיד/ה</th>
                          <th className="px-4 py-2 text-right font-medium">ניקוד</th>
                          <th className="px-4 py-2 text-right font-medium">נכונות</th>
                          <th className="px-4 py-2 text-right font-medium">דיוק</th>
                          <th className="px-4 py-2 text-right font-medium">הישגים</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.leaderboard.map((entry) => (
                          <StudentRow key={entry.participantId} entry={entry} achievements={achievementsByParticipant.get(entry.participantId) ?? []} questionCount={results.questionCount} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {results.hardestQuestions.length > 0 && (
                <Card padding="none" className="mt-6 p-6">
                  <h2 className="text-base font-bold text-brand-navy">שאלות שבהן הכיתה התקשתה</h2>
                  <p className="mb-4 text-sm text-slate-500">השאלות עם אחוז ההצלחה הנמוך ביותר – כדאי לחזור עליהן בכיתה.</p>
                  <ul className="grid gap-3">
                    {results.hardestQuestions.slice(0, 5).map((q) => (
                      <li key={q.sessionQuestionId} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 truncate">
                            <span className="ml-2 text-xs text-slate-400">{q.index + 1}.</span>
                            <span className="font-medium text-brand-navy">{q.prompt}</span>
                            <span className="mr-2 text-xs text-slate-400">({QUESTION_TYPE_LABELS[q.type]})</span>
                          </span>
                          <span className={`shrink-0 font-bold tabular-nums ${q.accuracy < 50 ? 'text-red-600' : 'text-amber-600'}`}>{formatPercent(q.accuracy)}</span>
                        </div>
                        <AccuracyBar value={q.accuracy} />
                        <div className="text-xs text-slate-500">
                          תשובה נכונה: <b className="text-brand-navy">{q.correctAnswerText}</b> · ענו {q.correct} מתוך {q.answered}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card padding="none" className="mt-6 p-6">
                <h2 className="mb-4 text-base font-bold text-brand-navy">פירוט לפי שאלה</h2>
                <div className="flex flex-col gap-2">
                  {results.questionStats.map((q) => (
                    <QuestionAccordion key={q.sessionQuestionId} stat={q} />
                  ))}
                </div>
              </Card>
            </>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => void handleExport('csv')} loading={exporting === 'csv'} disabled={exporting !== null}>
              <Download className="h-4 w-4" aria-hidden /> הורדת CSV
            </Button>
            <Button variant="ghost" onClick={() => void handleExport('xlsx')} loading={exporting === 'xlsx'} disabled={exporting !== null}>
              <Download className="h-4 w-4" aria-hidden /> הורדת Excel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccuracyBar({ value, tone }: { value: number; tone?: 'auto' | 'correct' | 'wrong' }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    tone === 'correct' ? 'bg-brand-green' : tone === 'wrong' ? 'bg-slate-300' : pct < 50 ? 'bg-red-400' : pct < 75 ? 'bg-amber-400' : 'bg-brand-green';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function StudentRow({ entry, achievements, questionCount }: { entry: LeaderboardEntry; achievements: AchievementType[]; questionCount: number }) {
  const medal = medalForRank(entry.rank);
  return (
    <tr className="border-t border-slate-100 hover:bg-slate-50/60">
      <td className="px-4 py-2.5 tabular-nums text-slate-500">{medal ? <Medal kind={medal} size="sm" /> : entry.rank}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Avatar id={entry.avatar} size="sm" />
          <span className="font-medium text-brand-navy">{entry.displayName}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 font-bold tabular-nums text-brand-violet">{formatNumber(entry.score)}</td>
      <td className="px-4 py-2.5 tabular-nums text-slate-700">
        {entry.correctAnswers}/{questionCount}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="w-16">
            <AccuracyBar value={entry.accuracy} />
          </div>
          <span className="tabular-nums text-slate-700">{formatPercent(entry.accuracy)}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {achievements.length === 0 && <span className="text-xs text-slate-300">—</span>}
          {achievements.map((a) => (
            <span key={a} title={`${ACHIEVEMENT_LABELS[a].title} – ${ACHIEVEMENT_LABELS[a].description}`} className="inline-flex items-center gap-1 rounded-full bg-brand-yellow/30 px-2 py-0.5 text-xs text-brand-navy" aria-label={ACHIEVEMENT_LABELS[a].title}>
              <span aria-hidden>{ACHIEVEMENT_LABELS[a].emoji}</span>
              <span className="hidden sm:inline">{ACHIEVEMENT_LABELS[a].title}</span>
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function QuestionAccordion({ stat }: { stat: QuestionStat }) {
  const [open, setOpen] = useState(false);
  const total = Math.max(stat.answered, 1);
  return (
    <div className="rounded-2xl border border-slate-200">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-right">
        <span className="w-6 shrink-0 text-xs text-slate-400 tabular-nums">{stat.index + 1}.</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-brand-navy">{stat.prompt}</span>
          <span className="block text-xs text-slate-400">{QUESTION_TYPE_LABELS[stat.type]}</span>
        </span>
        <span className="hidden w-24 sm:block">
          <AccuracyBar value={stat.accuracy} />
        </span>
        <span className={`w-12 shrink-0 text-sm font-bold tabular-nums ${stat.accuracy < 50 ? 'text-red-600' : stat.accuracy < 75 ? 'text-amber-600' : 'text-brand-green'}`}>{formatPercent(stat.accuracy)}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-2 text-xs text-slate-500">
            ענו {stat.answered} · נכון {stat.correct} · תשובה נכונה: <b className="text-brand-navy">{stat.correctAnswerText}</b>
          </div>
          <ul className="flex flex-col gap-2">
            {stat.distribution.map((d, i) => (
              <li key={`${d.text}-${i}`} className="flex items-center gap-3 text-sm">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${d.isCorrect ? 'bg-brand-green text-white' : 'bg-slate-100 text-slate-400'}`} aria-label={d.isCorrect ? 'תשובה נכונה' : 'תשובה שגויה'}>
                  {d.isCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
                <span className={`w-32 min-w-0 truncate sm:w-48 ${d.isCorrect ? 'font-semibold text-brand-navy' : 'text-slate-700'}`}>{d.text}</span>
                <div className="flex-1">
                  <AccuracyBar value={(d.count / total) * 100} tone={d.isCorrect ? 'correct' : 'wrong'} />
                </div>
                <span className="w-10 shrink-0 text-left text-xs tabular-nums text-slate-500">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ResultsPage;
