import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ChevronDown, Download, FileSpreadsheet, FileText, Flame, ListChecks, Medal as MedalIcon, Target, Trophy, Users, X } from 'lucide-react';
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
import { cn } from '@/lib/cn';
import { teacherApi, type ExportFormat } from '@/services/teacherApi';
import { useTeacherStore } from '@/stores/teacherStore';
import { PageHeader, Panel, StatCard, StateBadge } from './components';
import { formatDateTime, formatNumber, formatPercent, friendlyError, teacherPath } from './labels';

const percent = (n: number) => `${Math.round(n)}%`;

/** מזהה סבב = מזהה GameSession. ה־API מחזיר רק את הסבב הנוכחי/אחרון כברירת מחדל. */
export function ResultsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const games = useTeacherStore((s) => s.games);
  const loadGames = useTeacherStore((s) => s.loadGames);

  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const requestKey = `${id}|${sessionId ?? ''}`;
  // התוצאות האחרונות שנטענו (ייתכן שמסבב קודם בזמן טעינה) + שגיאה לבקשה הנוכחית
  const [resultsState, setResultsState] = useState<{ key: string; value: GameResults } | null>(null);
  const [errorState, setErrorState] = useState<{ key: string; message: string } | null>(null);
  const results = resultsState?.value ?? null;
  const error = errorState?.key === requestKey ? errorState.message : null;
  const loading = resultsState?.key !== requestKey && !error;
  const [knownSessions, setKnownSessions] = useState<Array<{ id: string; label: string }>>([]);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  const summary: GameSummary | undefined = games.find((g) => g.roomId === id);

  useEffect(() => {
    if (games.length === 0) void loadGames();
  }, [games.length, loadGames]);

  useEffect(() => {
    let cancelled = false;
    const key = `${id}|${sessionId ?? ''}`;
    teacherApi.games
      .results(id, sessionId)
      .then((r) => {
        if (cancelled) return;
        setResultsState({ key, value: r });
        setKnownSessions((prev) => {
          if (prev.some((s) => s.id === r.gameSessionId)) return prev;
          const label = r.startedAt ? `סבב מ־${formatDateTime(r.startedAt)}` : 'הסבב הנוכחי';
          return [...prev, { id: r.gameSessionId, label }];
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setErrorState({ key, message: friendlyError(err, 'לא הצלחנו לטעון את התוצאות') });
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
  const className = results?.className ?? summary?.className ?? 'חדר';

  return (
    <div>
      <PageHeader
        eyebrow="תוצאות"
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {className}
            {results && <StateBadge state={results.state} size="md" />}
          </span>
        }
        subtitle={results?.startedAt ? `התחיל ${formatDateTime(results.startedAt)}${results.finishedAt ? ` · הסתיים ${formatDateTime(results.finishedAt)}` : ''}` : undefined}
        crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: summary?.className ?? 'חדר', to: teacherPath(`rooms/${id}`) }, { label: 'תוצאות' }]}
        actions={
          <>
            <Link to={teacherPath(`rooms/${id}`)} className="rounded-2xl">
              <Button variant="ghost" size="md" tabIndex={-1}>
                <ArrowRight className="size-4" aria-hidden /> לחדר
              </Button>
            </Link>
            <Button variant="secondary" size="md" onClick={() => void handleExport('csv')} loading={exporting === 'csv'} disabled={exporting !== null || !results}>
              <FileText className="size-4" aria-hidden /> CSV
            </Button>
            <Button variant="primary" size="md" onClick={() => void handleExport('xlsx')} loading={exporting === 'xlsx'} disabled={exporting !== null || !results}>
              <FileSpreadsheet className="size-4" aria-hidden /> Excel
            </Button>
          </>
        }
      />

      {/* בחירת סבב */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label htmlFor="session-select" className="text-sm font-bold text-slate-600">
          סבב:
        </label>
        <div className="relative">
          <select
            id="session-select"
            value={sessionId ?? results?.gameSessionId ?? ''}
            onChange={(e) => setSessionId(e.target.value || undefined)}
            className="min-h-11 appearance-none rounded-xl border border-slate-200 bg-white/90 py-2 pe-3 ps-9 text-sm font-semibold text-brand-navy shadow-sm focus:border-brand-violet focus:outline-none focus:ring-4 focus:ring-brand-violet/20"
          >
            {knownSessions.length === 0 && <option value="">הסבב האחרון</option>}
            {knownSessions.map((s, i) => (
              <option key={s.id} value={s.id}>
                {knownSessions.length > 1 ? `${i + 1}. ` : ''}
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        </div>
        {sessionCount > 1 && <span className="text-xs text-slate-400">בחדר זה התקיימו {sessionCount} סבבים · מוצג הסבב האחרון כברירת מחדל</span>}
      </div>

      {error && (
        <Card variant="glass" padding="none" className="p-6 sm:p-8">
          <EmptyState title="לא הצלחנו לטעון את התוצאות" description={error} className="bg-transparent" />
        </Card>
      )}

      {loading && !results && (
        <div className="flex justify-center py-24">
          <Spinner className="text-brand-violet" />
        </div>
      )}

      {results && (
        <div className={cn('transition-opacity', loading && 'opacity-60')}>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="סיכום">
            <StatCard label="ממוצע כיתתי" value={Math.round(results.classAverage)} hint="נקודות לתלמיד" icon={Trophy} tone="yellow" delay={0} />
            <StatCard label="דיוק כיתתי" value={results.classAccuracy} format={percent} icon={Target} tone="green" delay={0.06} />
            <StatCard label="תלמידים" value={results.leaderboard.length} icon={Users} tone="sky" delay={0.12} />
            <StatCard label="שאלות" value={results.questionCount} icon={ListChecks} tone="violet" delay={0.18} />
          </section>

          {results.leaderboard.length === 0 ? (
            <Card variant="glass" padding="none" className="mt-5 p-6 sm:p-8">
              <EmptyState title="אין עדיין תוצאות" description="כשהתלמידים יתחילו לענות – התוצאות יופיעו כאן." className="bg-transparent" />
            </Card>
          ) : (
            <>
              <div className="mt-5 grid gap-5 lg:grid-cols-3">
                <Panel title="הפודיום" description="שלושת המקומות הראשונים" icon={<MedalIcon className="size-5" aria-hidden />} tone="green" className="lg:col-span-1">
                  <div className="overflow-hidden rounded-2xl bg-linear-to-b from-sky-50/80 to-amber-50/60 px-2 pb-0 pt-4 ring-1 ring-white">
                    <Leaderboard entries={results.leaderboard.slice(0, 3)} showPodium compact />
                  </div>
                </Panel>

                <Panel title="כל התלמידים" description={`${results.leaderboard.length} תלמידים · ממוינים לפי ניקוד`} icon={<Users className="size-5" aria-hidden />} flush className="lg:col-span-2">
                  {/* טבלה – טאבלט ומעלה */}
                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 text-xs font-bold text-slate-500">
                        <tr>
                          <th className="px-5 py-3 text-start">#</th>
                          <th className="px-4 py-3 text-start">תלמיד/ה</th>
                          <th className="px-4 py-3 text-start">ניקוד</th>
                          <th className="px-4 py-3 text-start">נכונות</th>
                          <th className="px-4 py-3 text-start">דיוק</th>
                          <th className="px-4 py-3 text-start">הישגים</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.leaderboard.map((entry) => (
                          <StudentRow key={entry.participantId} entry={entry} achievements={achievementsByParticipant.get(entry.participantId) ?? []} questionCount={results.questionCount} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* כרטיסים – נייד */}
                  <ul className="flex flex-col gap-2 p-3 md:hidden" aria-label="כל התלמידים">
                    {results.leaderboard.map((entry) => (
                      <StudentCard key={entry.participantId} entry={entry} achievements={achievementsByParticipant.get(entry.participantId) ?? []} questionCount={results.questionCount} />
                    ))}
                  </ul>
                </Panel>
              </div>

              {results.hardestQuestions.length > 0 && (
                <Panel className="mt-5" title="שאלות שבהן הכיתה התקשתה" description="השאלות עם אחוז ההצלחה הנמוך ביותר – כדאי לחזור עליהן בכיתה." icon={<Flame className="size-5" aria-hidden />} tone="navy">
                  <ul className="grid gap-3 md:grid-cols-2">
                    {results.hardestQuestions.slice(0, 6).map((q) => (
                      <li key={q.sessionQuestionId} className="flex flex-col gap-2 rounded-2xl bg-white/70 p-4 ring-1 ring-slate-100">
                        <div className="flex items-start justify-between gap-3 text-sm">
                          <span className="min-w-0">
                            <span className="me-1.5 text-xs text-slate-400 tabular-nums">{q.index + 1}.</span>
                            <span className="font-bold text-brand-navy">{q.prompt}</span>
                            <span className="ms-1.5 text-xs text-slate-400">({QUESTION_TYPE_LABELS[q.type]})</span>
                          </span>
                          <span className={cn('shrink-0 text-base font-black tabular-nums', q.accuracy < 50 ? 'text-rose-600' : 'text-amber-600')}>{formatPercent(q.accuracy)}</span>
                        </div>
                        <AccuracyBar value={q.accuracy} />
                        <div className="text-xs text-slate-500">
                          תשובה נכונה: <b className="text-brand-navy">{q.correctAnswerText}</b> · ענו נכון {q.correct} מתוך {q.answered}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}

              <Panel className="mt-5" title="פירוט לפי שאלה" description="לחצו על שאלה כדי לראות את התפלגות התשובות." icon={<ListChecks className="size-5" aria-hidden />}>
                <div className="flex flex-col gap-2">
                  {results.questionStats.map((q) => (
                    <QuestionAccordion key={q.sessionQuestionId} stat={q} />
                  ))}
                </div>
              </Panel>
            </>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="md" onClick={() => void handleExport('csv')} loading={exporting === 'csv'} disabled={exporting !== null}>
              <Download className="size-4" aria-hidden /> הורדת CSV
            </Button>
            <Button variant="ghost" size="md" onClick={() => void handleExport('xlsx')} loading={exporting === 'xlsx'} disabled={exporting !== null}>
              <Download className="size-4" aria-hidden /> הורדת Excel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccuracyBar({ value, tone, className }: { value: number; tone?: 'auto' | 'correct' | 'wrong'; className?: string }) {
  const reduce = useReducedMotion();
  const pct = Math.max(0, Math.min(100, value));
  const color =
    tone === 'correct'
      ? 'from-emerald-400 to-green-500'
      : tone === 'wrong'
        ? 'from-slate-300 to-slate-400'
        : pct < 50
          ? 'from-rose-400 to-red-500'
          : pct < 75
            ? 'from-amber-300 to-orange-400'
            : 'from-emerald-400 to-green-500';
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cn('h-full rounded-full bg-linear-to-l', color)} initial={reduce ? false : { width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} />
    </div>
  );
}

function AchievementChips({ achievements, compact }: { achievements: AchievementType[]; compact?: boolean }) {
  if (achievements.length === 0) return <span className="text-xs text-slate-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {achievements.map((a) => (
        <span
          key={a}
          title={`${ACHIEVEMENT_LABELS[a].title} – ${ACHIEVEMENT_LABELS[a].description}`}
          className="inline-flex items-center gap-1 rounded-full bg-linear-to-b from-yellow-100 to-amber-100 px-2 py-0.5 text-xs font-semibold text-brand-navy ring-1 ring-amber-200/70"
          aria-label={ACHIEVEMENT_LABELS[a].title}
        >
          <span aria-hidden>{ACHIEVEMENT_LABELS[a].emoji}</span>
          {!compact && <span className="hidden lg:inline">{ACHIEVEMENT_LABELS[a].title}</span>}
        </span>
      ))}
    </div>
  );
}

function RankCell({ rank }: { rank: number }) {
  const medal = medalForRank(rank);
  return medal ? <Medal kind={medal} size="sm" className="size-9" /> : <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-xs font-black text-slate-600 tabular-nums">{rank}</span>;
}

function StudentRow({ entry, achievements, questionCount }: { entry: LeaderboardEntry; achievements: AchievementType[]; questionCount: number }) {
  return (
    <tr className="border-t border-slate-100 transition-colors odd:bg-white/40 even:bg-slate-50/40 hover:bg-violet-50/50">
      <td className="px-5 py-2.5">
        <RankCell rank={entry.rank} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Avatar id={entry.avatar} size="xs" />
          <span className="font-bold text-brand-navy">{entry.displayName}</span>
        </div>
      </td>
      <td className="px-4 py-2.5 font-black tabular-nums text-brand-violet">{formatNumber(entry.score)}</td>
      <td className="px-4 py-2.5 tabular-nums text-slate-700">
        {entry.correctAnswers}/{questionCount}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <AccuracyBar value={entry.accuracy} className="w-20" />
          <span className="w-10 text-xs font-bold tabular-nums text-slate-700">{formatPercent(entry.accuracy)}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <AchievementChips achievements={achievements} />
      </td>
    </tr>
  );
}

function StudentCard({ entry, achievements, questionCount }: { entry: LeaderboardEntry; achievements: AchievementType[]; questionCount: number }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-2xl bg-white/80 p-3 ring-1 ring-slate-100">
      <div className="flex items-center gap-3">
        <RankCell rank={entry.rank} />
        <Avatar id={entry.avatar} size="xs" />
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-brand-navy">{entry.displayName}</span>
        <span className="text-base font-black tabular-nums text-brand-violet">{formatNumber(entry.score)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span className="shrink-0 tabular-nums">
          {entry.correctAnswers}/{questionCount} נכונות
        </span>
        <AccuracyBar value={entry.accuracy} className="flex-1" />
        <span className="w-9 shrink-0 text-end font-bold tabular-nums">{formatPercent(entry.accuracy)}</span>
      </div>
      {achievements.length > 0 && <AchievementChips achievements={achievements} compact />}
    </li>
  );
}

function QuestionAccordion({ stat }: { stat: QuestionStat }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const total = Math.max(stat.answered, 1);
  const toneText = stat.accuracy < 50 ? 'text-rose-600' : stat.accuracy < 75 ? 'text-amber-600' : 'text-emerald-600';
  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-white/70 transition-colors', open ? 'border-violet-200 shadow-[0_12px_28px_-20px_rgba(139,92,246,.6)]' : 'border-slate-200/80 hover:border-violet-200')}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-0 w-full items-center gap-3 px-3 py-3 text-start sm:px-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-600 tabular-nums">{stat.index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-brand-navy">{stat.prompt}</span>
          <span className="block text-xs text-slate-400">{QUESTION_TYPE_LABELS[stat.type]}</span>
        </span>
        <span className="hidden w-24 sm:block">
          <AccuracyBar value={stat.accuracy} />
        </span>
        <span className={cn('w-12 shrink-0 text-end text-sm font-black tabular-nums', toneText)}>{formatPercent(stat.accuracy)}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 px-3 py-3 sm:px-4">
              <div className="mb-3 text-xs text-slate-500">
                ענו {stat.answered} · נכון {stat.correct} · תשובה נכונה: <b className="text-brand-navy">{stat.correctAnswerText}</b>
              </div>
              <ul className="flex flex-col gap-2">
                {stat.distribution.map((d, i) => (
                  <li key={`${d.text}-${i}`} className="flex items-center gap-3 text-sm">
                    <span className={cn('grid size-5 shrink-0 place-items-center rounded-full', d.isCorrect ? 'bg-brand-green text-white' : 'bg-slate-100 text-slate-400')} aria-label={d.isCorrect ? 'תשובה נכונה' : 'תשובה שגויה'} role="img">
                      {d.isCorrect ? <Check className="size-3" strokeWidth={3} /> : <X className="size-3" />}
                    </span>
                    <span className={cn('w-28 min-w-0 truncate sm:w-48', d.isCorrect ? 'font-bold text-brand-navy' : 'text-slate-700')}>{d.text}</span>
                    <AccuracyBar value={(d.count / total) * 100} tone={d.isCorrect ? 'correct' : 'wrong'} className="flex-1" />
                    <span className="w-8 shrink-0 text-end text-xs font-bold tabular-nums text-slate-500">{d.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ResultsPage;
