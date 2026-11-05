import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Gem, Info, Rocket, Users } from 'lucide-react';
import {
  CATEGORY_LABELS,
  Category,
  DIFFICULTY_LABELS,
  GameMode,
  QUESTION_COUNT_OPTIONS,
  QUESTION_TYPE_LABELS,
  QuestionType,
  TIME_PER_QUESTION_OPTIONS,
  type DifficultySetting,
  type GameSettings,
} from '@oc/shared';
import { Button, Card, Input, toast } from '@/components/ui';
import { useTeacherStore } from '@/stores/teacherStore';
import { MultiChips, PageHeader, SingleChips, Toggle } from './components';
import { MODE_LABELS, friendlyError, teacherPath, timeLabel } from './labels';

const ALL_CATEGORIES = Object.values(Category);
const DIFFICULTIES: DifficultySetting[] = ['EASY', 'MEDIUM', 'HARD', 'MIXED'];
/** סוגי השאלות הרגילים – אתגר האוצר נבחר במתג נפרד. */
const REGULAR_TYPES = Object.values(QuestionType).filter((t) => t !== QuestionType.TREASURE_CHALLENGE);

export const DEFAULT_SETTINGS: GameSettings = {
  className: '',
  questionCount: 12,
  difficulty: 'MIXED',
  categories: [...ALL_CATEGORIES],
  timePerQuestionSec: 20,
  questionTypes: [...REGULAR_TYPES],
  mode: GameMode.SELF_PACED,
  competitionEnabled: true,
  showLeaderboard: true,
  showCorrectAnswers: true,
  soundsEnabled: true,
  treasureChallenge: false,
};

type Errors = Partial<Record<'className' | 'categories' | 'questionTypes', string>>;

export function validateSettings(s: GameSettings): Errors {
  const errors: Errors = {};
  const name = s.className.trim();
  if (!name) errors.className = 'יש להזין שם כיתה';
  else if (name.length < 2) errors.className = 'שם הכיתה קצר מדי';
  else if (name.length > 40) errors.className = 'שם הכיתה ארוך מדי (עד 40 תווים)';
  if (s.categories.length === 0) errors.categories = 'יש לבחור לפחות קטגוריה אחת';
  if (s.questionTypes.length === 0) errors.questionTypes = 'יש לבחור לפחות סוג שאלה אחד';
  return errors;
}

function Section({ title, description, children, error }: { title: string; description?: string; children: React.ReactNode; error?: string }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <div>
        <legend className="text-base font-bold text-brand-navy">{title}</legend>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {children}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function CreateGamePage() {
  const navigate = useNavigate();
  const createGame = useTeacherStore((s) => s.createGame);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  const patch = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const categoryOptions = useMemo(() => ALL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })), []);
  const typeOptions = useMemo(() => REGULAR_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] })), []);

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

  return (
    <div>
      <PageHeader
        title="משחק חדש"
        subtitle="מגדירים את המשחק, לוחצים על ״יצירת חדר״ והתלמידים מצטרפים עם הקוד."
        crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: 'משחק חדש' }]}
      />

      <form onSubmit={handleSubmit} noValidate className="grid gap-6 lg:grid-cols-3" aria-label="הגדרות משחק">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card padding="none" className="flex flex-col gap-6 p-6">
            <Section title="פרטי הכיתה">
              <Input
                label="שם הכיתה"
                name="className"
                value={settings.className}
                onChange={(e) => patch('className', e.target.value)}
                error={errors.className}
                placeholder="לדוגמה: כיתה ג׳2"
                maxLength={40}
                required
              />
            </Section>

            <Section title="מספר שאלות">
              <SingleChips
                name="מספר שאלות"
                options={QUESTION_COUNT_OPTIONS.map((n) => ({ value: n, label: `${n} שאלות` }))}
                value={settings.questionCount}
                onChange={(v) => patch('questionCount', v)}
              />
            </Section>

            <Section title="רמת קושי">
              <SingleChips
                name="רמת קושי"
                options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))}
                value={settings.difficulty}
                onChange={(v) => patch('difficulty', v)}
              />
            </Section>

            <Section title="קטגוריות" description="השאלות ייבחרו מתוך הקטגוריות המסומנות." error={errors.categories}>
              <MultiChips
                name="קטגוריות"
                allLabel="בחר הכול"
                options={categoryOptions}
                value={settings.categories}
                onChange={(v) => patch('categories', v)}
              />
            </Section>

            <Section title="זמן לשאלה" description="בלי הגבלת זמן אין בונוס מהירות.">
              <SingleChips
                name="זמן לשאלה"
                options={TIME_PER_QUESTION_OPTIONS.map((t) => ({ value: t, label: timeLabel(t) }))}
                value={settings.timePerQuestionSec}
                onChange={(v) => patch('timePerQuestionSec', v)}
              />
            </Section>

            <Section title="סוגי שאלות" error={errors.questionTypes}>
              <MultiChips
                name="סוגי שאלות"
                options={typeOptions}
                value={settings.questionTypes}
                onChange={(v) => patch('questionTypes', v)}
              />
              <div className="mt-1">
                <Toggle
                  name="treasureChallenge"
                  checked={settings.treasureChallenge}
                  onChange={(v) => patch('treasureChallenge', v)}
                  disabled={treasureDisabled}
                  label={`${QUESTION_TYPE_LABELS.TREASURE_CHALLENGE} 💎`}
                  description="5 השאלות האחרונות הופכות לאתגר: 5 תשובות נכונות ברצף מזכות בבונוס של 150 נקודות."
                />
              </div>
            </Section>
          </Card>

          <Card padding="none" className="flex flex-col gap-4 p-6">
            <Section title="מצב משחק">
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.values(GameMode) as GameMode[]).map((mode) => {
                  const selected = settings.mode === mode;
                  const Icon = mode === GameMode.SELF_PACED ? Rocket : Users;
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => patch('mode', mode)}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-right transition-colors ${
                        selected ? 'border-brand-violet bg-brand-violet/5 ring-2 ring-brand-violet/30' : 'border-slate-200 bg-white hover:border-brand-violet/50'
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-brand-violet text-white' : 'bg-slate-100 text-slate-500'}`}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <div className="font-bold text-brand-navy">
                          {MODE_LABELS[mode].label}
                          {mode === GameMode.SELF_PACED && <span className="mr-2 text-xs font-normal text-slate-400">(ברירת מחדל)</span>}
                        </div>
                        <div className="mt-0.5 text-xs leading-5 text-slate-500">{MODE_LABELS[mode].description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card padding="none" className="flex flex-col gap-3 p-6">
            <h2 className="text-base font-bold text-brand-navy">אפשרויות</h2>
            <Toggle name="competitionEnabled" checked={settings.competitionEnabled} onChange={(v) => patch('competitionEnabled', v)} label="מצב תחרות" description="ניקוד, בונוס מהירות ודירוג." />
            <Toggle name="showLeaderboard" checked={settings.showLeaderboard} onChange={(v) => patch('showLeaderboard', v)} label="הצגת טבלת דירוג לתלמידים" />
            <Toggle name="showCorrectAnswers" checked={settings.showCorrectAnswers} onChange={(v) => patch('showCorrectAnswers', v)} label="הצגת התשובה הנכונה" description="אחרי כל שאלה, עם הסבר קצר." />
            <Toggle name="soundsEnabled" checked={settings.soundsEnabled} onChange={(v) => patch('soundsEnabled', v)} label="צלילים" />
          </Card>

          <Card padding="none" className="sticky top-24 flex flex-col gap-4 p-6">
            <h2 className="text-base font-bold text-brand-navy">סיכום</h2>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-slate-500">כיתה</dt>
              <dd className="truncate font-medium text-brand-navy">{settings.className.trim() || '—'}</dd>
              <dt className="text-slate-500">שאלות</dt>
              <dd className="font-medium text-brand-navy">{settings.questionCount}</dd>
              <dt className="text-slate-500">קושי</dt>
              <dd className="font-medium text-brand-navy">{DIFFICULTY_LABELS[settings.difficulty]}</dd>
              <dt className="text-slate-500">קטגוריות</dt>
              <dd className="font-medium text-brand-navy">{settings.categories.length === ALL_CATEGORIES.length ? 'כולן' : settings.categories.length}</dd>
              <dt className="text-slate-500">זמן</dt>
              <dd className="font-medium text-brand-navy">{timeLabel(settings.timePerQuestionSec)}</dd>
              <dt className="text-slate-500">מצב</dt>
              <dd className="font-medium text-brand-navy">{MODE_LABELS[settings.mode].label}</dd>
              {settings.treasureChallenge && (
                <>
                  <dt className="text-slate-500">אתגר</dt>
                  <dd className="inline-flex items-center gap-1 font-medium text-brand-navy">
                    <Gem className="h-4 w-4 text-brand-violet" aria-hidden /> אתגר האוצר
                  </dd>
                </>
              )}
            </dl>
            <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting}>
              <Rocket className="h-5 w-5" aria-hidden />
              יצירת חדר
            </Button>
            <p className="flex items-start gap-2 text-xs text-slate-400">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              אחרי יצירת החדר יוצג קוד בן 6 ספרות ו־QR להצטרפות מהטאבלטים.
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}

export default CreateGamePage;
