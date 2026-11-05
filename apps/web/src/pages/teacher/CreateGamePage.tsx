import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { BookOpenText, CheckCircle2, Gem, Info, ListOrdered, Rocket, Settings2, SlidersHorizontal, Timer, Trophy, Users, Volume2 } from 'lucide-react';
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  GameMode,
  QUESTION_COUNT_OPTIONS,
  QUESTION_TYPE_LABELS,
  QuestionType,
  TIME_PER_QUESTION_OPTIONS,
  type GameSettings,
} from '@oc/shared';
import { Button, Input, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useTeacherStore } from '@/stores/teacherStore';
import { MultiChips, PageHeader, Panel, SingleChips, Stepper, Toggle, type StepperStep } from './components';
import { MODE_LABELS, friendlyError, teacherPath, timeLabel } from './labels';
import { ALL_CATEGORIES, DEFAULT_SETTINGS, DIFFICULTIES, REGULAR_TYPES, validateSettings, type GameSettingsErrors as Errors } from './gameSettingsForm';

const STEPS: readonly StepperStep[] = [
  { key: 'general', label: 'כללי', icon: Settings2 },
  { key: 'content', label: 'תוכן', icon: BookOpenText },
  { key: 'timing', label: 'זמן ומשחק', icon: Timer },
  { key: 'options', label: 'אפשרויות', icon: SlidersHorizontal },
];

const MODE_ART: Record<GameMode, { src: string; icon: typeof Rocket; accent: string }> = {
  [GameMode.SELF_PACED]: { src: '/images/characters/sun-cheer.svg', icon: Rocket, accent: 'from-amber-200/70 to-orange-100/40' },
  [GameMode.TEACHER_PACED]: { src: '/images/characters/moon.svg', icon: Users, accent: 'from-indigo-200/70 to-violet-100/40' },
};

function Field({ title, description, children, error }: { title: string; description?: string; children: ReactNode; error?: string }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <div>
        <legend className="text-sm font-extrabold text-brand-navy">{title}</legend>
        {description && <p className="mt-0.5 text-xs leading-5 text-slate-600">{description}</p>}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function CreateGamePage() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const createGame = useTeacherStore((s) => s.createGame);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);

  const patch = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => setSettings((prev) => ({ ...prev, [key]: value }));

  const categoryOptions = useMemo(() => ALL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })), []);
  const typeOptions = useMemo(() => REGULAR_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] })), []);

  // מעקב אחרי הקטע הנראה – מעדכן את ה־Stepper
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = sectionRefs.current.filter((el): el is HTMLElement => el !== null);
    const visible = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target, e.isIntersecting ? e.intersectionRatio : 0);
        let best = -1;
        let bestRatio = 0;
        els.forEach((el, i) => {
          const r = visible.get(el) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = i;
          }
        });
        if (best >= 0) setActiveStep(best);
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.2, 0.5, 0.8, 1] },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const goTo = (i: number) => {
    setActiveStep(i);
    const el = sectionRefs.current[i];
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: GameSettings = {
      ...settings,
      className: settings.className.trim(),
      // סדר יציב ומנוקה מכפילויות
      categories: ALL_CATEGORIES.filter((c) => settings.categories.includes(c)),
      questionTypes: REGULAR_TYPES.filter((t) => settings.questionTypes.includes(t)),
    };
    const nextErrors = validateSettings(payload);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      toast.error('יש להשלים את השדות המסומנים');
      goTo(nextErrors.className ? 0 : 1);
      return;
    }
    setSubmitting(true);
    try {
      const summary = await createGame(payload);
      toast.success(`החדר נוצר! קוד: ${summary.code}`);
      navigate(teacherPath(`rooms/${summary.roomId}`));
    } catch (err) {
      toast.error(friendlyError(err, 'יצירת המשחק נכשלה'));
      setSubmitting(false);
    }
  };

  const treasureDisabled = settings.questionTypes.length === 0 || (settings.questionTypes.length === 1 && settings.questionTypes[0] === QuestionType.MATCH_PAIRS);
  const categoriesLabel = settings.categories.length === ALL_CATEGORIES.length ? 'כל הקטגוריות' : `${settings.categories.length} קטגוריות`;
  const ready = settings.className.trim().length > 0 && settings.categories.length > 0 && settings.questionTypes.length > 0;

  return (
    <div className="pb-24 xl:pb-0">
      <PageHeader
        eyebrow="הגדרת משחק"
        title="משחק חדש"
        subtitle="מגדירים את המשחק, לוחצים על ״יצירת חדר״ – והתלמידים מצטרפים עם הקוד."
        crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: 'משחק חדש' }]}
      />

      {/* Stepper דביק */}
      <div className="sticky top-16 z-20 -mx-4 mb-6 bg-linear-to-b from-slate-50/95 to-slate-50/70 px-4 pb-3 pt-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="mx-auto max-w-3xl rounded-[1.5rem] bg-white/70 px-3 py-3 shadow-[0_10px_30px_-18px_rgba(30,41,59,.35)] ring-1 ring-white/80 sm:px-6">
          <Stepper steps={STEPS} current={activeStep} onSelect={goTo} label="שלבי ההגדרה" />
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start" aria-label="הגדרות משחק">
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
          {/* 1 – כללי */}
          <div
            ref={(el) => {
              sectionRefs.current[0] = el;
            }}
            id="step-general"
            className="scroll-mt-40"
          >
          <Panel
            step={1}
            title="כללי"
            description="שם הכיתה ואופן ההתקדמות במשחק."
          >
            <div className="flex flex-col gap-5">
              <Input
                label="שם הכיתה"
                name="className"
                size="md"
                value={settings.className}
                onChange={(e) => patch('className', e.target.value)}
                error={errors.className}
                placeholder="לדוגמה: כיתה ג׳2"
                maxLength={40}
                required
              />
              <Field title="מצב משחק" description="אפשר לשנות את המצב בכל משחק חדש.">
                <div role="radiogroup" aria-label="מצב משחק" className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {(Object.values(GameMode) as GameMode[]).map((mode) => {
                    const selected = settings.mode === mode;
                    const art = MODE_ART[mode];
                    const Icon = art.icon;
                    return (
                      <motion.button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => patch('mode', mode)}
                        whileTap={reduce ? undefined : { scale: 0.985 }}
                        className={cn(
                          'group relative flex min-h-0 items-stretch gap-3 overflow-hidden rounded-2xl border p-3 text-start transition-[border-color,box-shadow] duration-200 sm:p-4',
                          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-violet/30',
                          selected
                            ? 'border-violet-400 bg-white shadow-[0_18px_30px_-18px_rgba(139,92,246,.7),0_0_0_3px_rgba(139,92,246,.18)]'
                            : 'border-slate-200/90 bg-white/70 hover:border-violet-300 hover:shadow-[0_12px_24px_-16px_rgba(30,41,59,.35)]',
                        )}
                      >
                        <span className={cn('absolute inset-0 bg-linear-to-br opacity-0 transition-opacity', art.accent, selected && 'opacity-100')} aria-hidden />
                        <span className="relative grid size-16 shrink-0 place-items-center rounded-2xl bg-white/80 shadow-inner ring-1 ring-white sm:size-20">
                          <img src={art.src} alt="" className="size-12 drop-shadow sm:size-16" />
                        </span>
                        <span className="relative min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={cn('grid size-6 place-items-center rounded-lg', selected ? 'bg-brand-violet text-white' : 'bg-slate-100 text-slate-600')}>
                              <Icon className="size-3.5" aria-hidden />
                            </span>
                            <span className="font-extrabold text-brand-navy">{MODE_LABELS[mode].label}</span>
                            {mode === GameMode.SELF_PACED && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">ברירת מחדל</span>}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-slate-600">{MODE_LABELS[mode].description}</span>
                        </span>
                        <span
                          className={cn(
                            'relative mt-1 grid size-6 shrink-0 place-items-center self-start rounded-full transition-colors',
                            selected ? 'bg-brand-violet text-white' : 'bg-slate-100 text-transparent',
                          )}
                          aria-hidden
                        >
                          <CheckCircle2 className="size-4" />
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Panel>
          </div>

          {/* 2 – תוכן */}
          <div
            ref={(el) => {
              sectionRefs.current[1] = el;
            }}
            id="step-content"
            className="scroll-mt-40"
          >
          <Panel
            step={2}
            title="תוכן"
            description="מאילו קטגוריות ובאילו סוגי שאלות ישחקו."
          >
            <div className="flex flex-col gap-6">
              <Field title="קטגוריות" description="השאלות ייבחרו מתוך הקטגוריות המסומנות." error={errors.categories}>
                <MultiChips name="קטגוריות" allLabel="בחר הכול" options={categoryOptions} value={settings.categories} onChange={(v) => patch('categories', v)} />
              </Field>
              <Field title="סוגי שאלות" error={errors.questionTypes}>
                <MultiChips name="סוגי שאלות" options={typeOptions} value={settings.questionTypes} onChange={(v) => patch('questionTypes', v)} />
                <div className="mt-1">
                  <Toggle
                    name="treasureChallenge"
                    checked={settings.treasureChallenge}
                    onChange={(v) => patch('treasureChallenge', v)}
                    disabled={treasureDisabled}
                    icon={<Gem className="size-4" aria-hidden />}
                    label={`${QUESTION_TYPE_LABELS.TREASURE_CHALLENGE} 💎`}
                    description="5 השאלות האחרונות הופכות לאתגר: 5 תשובות נכונות ברצף מזכות בבונוס של 150 נקודות."
                  />
                </div>
              </Field>
            </div>
          </Panel>
          </div>

          {/* 3 – זמן ומשחק */}
          <div
            ref={(el) => {
              sectionRefs.current[2] = el;
            }}
            id="step-timing"
            className="scroll-mt-40"
          >
          <Panel
            step={3}
            title="זמן ומשחק"
            description="כמה שאלות, באיזו רמה ובכמה זמן."
          >
            <div className="grid gap-6 md:grid-cols-2">
              <Field title="מספר שאלות">
                <SingleChips name="מספר שאלות" options={QUESTION_COUNT_OPTIONS.map((n) => ({ value: n, label: `${n} שאלות` }))} value={settings.questionCount} onChange={(v) => patch('questionCount', v)} />
              </Field>
              <Field title="רמת קושי">
                <SingleChips name="רמת קושי" options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))} value={settings.difficulty} onChange={(v) => patch('difficulty', v)} />
              </Field>
              <Field title="זמן לשאלה" description="בלי הגבלת זמן אין בונוס מהירות.">
                <SingleChips name="זמן לשאלה" options={TIME_PER_QUESTION_OPTIONS.map((t) => ({ value: t, label: timeLabel(t) }))} value={settings.timePerQuestionSec} onChange={(v) => patch('timePerQuestionSec', v)} />
              </Field>
            </div>
          </Panel>
          </div>

          {/* 4 – אפשרויות */}
          <div
            ref={(el) => {
              sectionRefs.current[3] = el;
            }}
            id="step-options"
            className="scroll-mt-40"
          >
          <Panel
            step={4}
            title="אפשרויות"
            description="תחרותיות, משוב וצלילים."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Toggle name="competitionEnabled" checked={settings.competitionEnabled} onChange={(v) => patch('competitionEnabled', v)} icon={<Trophy className="size-4" aria-hidden />} label="מצב תחרות" description="ניקוד, בונוס מהירות ודירוג." />
              <Toggle name="showLeaderboard" checked={settings.showLeaderboard} onChange={(v) => patch('showLeaderboard', v)} icon={<ListOrdered className="size-4" aria-hidden />} label="הצגת טבלת דירוג לתלמידים" />
              <Toggle name="showCorrectAnswers" checked={settings.showCorrectAnswers} onChange={(v) => patch('showCorrectAnswers', v)} icon={<CheckCircle2 className="size-4" aria-hidden />} label="הצגת התשובה הנכונה" description="אחרי כל שאלה, עם הסבר קצר." />
              <Toggle name="soundsEnabled" checked={settings.soundsEnabled} onChange={(v) => patch('soundsEnabled', v)} icon={<Volume2 className="size-4" aria-hidden />} label="צלילים" />
            </div>
          </Panel>
          </div>
        </div>

        {/* סיכום חי – כרטיס דביק בדסקטופ, סרגל תחתון בנייד */}
        <aside className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 lg:bottom-0 xl:static xl:bottom-auto xl:z-auto">
          <div className="border-t border-white/70 bg-white/85 px-4 py-3 shadow-[0_-12px_30px_-20px_rgba(30,41,59,.4)] backdrop-blur-xl sm:px-6 xl:sticky xl:top-24 xl:rounded-[1.75rem] xl:border xl:border-white/70 xl:bg-white/85 xl:p-6 xl:shadow-card">
            <div className="mx-auto flex max-w-7xl items-center gap-3 xl:flex-col xl:items-stretch xl:gap-4">
              <div className="min-w-0 flex-1 xl:hidden">
                <div className="truncate text-sm font-extrabold text-brand-navy">{settings.className.trim() || 'כיתה ללא שם'}</div>
                <div className="truncate text-xs text-slate-600">
                  {settings.questionCount} שאלות · {DIFFICULTY_LABELS[settings.difficulty]} · {timeLabel(settings.timePerQuestionSec)} · {categoriesLabel}
                </div>
              </div>

              <div className="hidden xl:block">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-extrabold text-brand-navy">סיכום המשחק</h2>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>{ready ? 'מוכן ליצירה' : 'חסרים פרטים'}</span>
                </div>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
                  <dt className="text-slate-600">כיתה</dt>
                  <dd className="truncate text-end font-bold text-brand-navy">{settings.className.trim() || '—'}</dd>
                  <dt className="text-slate-600">מצב</dt>
                  <dd className="text-end font-bold text-brand-navy">{MODE_LABELS[settings.mode].label}</dd>
                  <dt className="text-slate-600">שאלות</dt>
                  <dd className="text-end font-bold text-brand-navy tabular-nums">{settings.questionCount}</dd>
                  <dt className="text-slate-600">קושי</dt>
                  <dd className="text-end font-bold text-brand-navy">{DIFFICULTY_LABELS[settings.difficulty]}</dd>
                  <dt className="text-slate-600">קטגוריות</dt>
                  <dd className="text-end font-bold text-brand-navy">{categoriesLabel}</dd>
                  <dt className="text-slate-600">סוגי שאלות</dt>
                  <dd className="text-end font-bold text-brand-navy">{settings.questionTypes.length} מתוך {REGULAR_TYPES.length}</dd>
                  <dt className="text-slate-600">זמן לשאלה</dt>
                  <dd className="text-end font-bold text-brand-navy">{timeLabel(settings.timePerQuestionSec)}</dd>
                  {settings.treasureChallenge && (
                    <>
                      <dt className="text-slate-600">אתגר</dt>
                      <dd className="inline-flex items-center justify-end gap-1 text-end font-bold text-brand-navy">
                        <Gem className="size-4 text-violet-700" aria-hidden /> אתגר האוצר
                      </dd>
                    </>
                  )}
                </dl>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {settings.competitionEnabled && <Tag>תחרות</Tag>}
                  {settings.showLeaderboard && <Tag>דירוג</Tag>}
                  {settings.showCorrectAnswers && <Tag>תשובות נכונות</Tag>}
                  {settings.soundsEnabled && <Tag>צלילים</Tag>}
                </div>
              </div>

              <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting} className="shrink-0 xl:w-full">
                <Rocket className="size-5" aria-hidden />
                יצירת חדר
              </Button>

              <p className="hidden items-start gap-2 text-xs leading-5 text-slate-500 xl:flex">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                אחרי יצירת החדר יוצג קוד בן 6 ספרות ו־QR להצטרפות מהטאבלטים.
              </p>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-700 ring-1 ring-violet-100">{children}</span>;
}

export default CreateGamePage;
