import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  CATEGORY_LABELS,
  Category,
  DIFFICULTY_LABELS,
  Difficulty,
  QUESTION_TYPE_LABELS,
  QuestionType,
  type WordPairContent,
} from '@oc/shared';
import { Button, Card, EmptyState, Input, Modal, Spinner, toast } from '@/components/ui';
import { teacherApi, type CategoryInfo, type MediaItem, type WordPairInput } from '@/services/teacherApi';
import { ConfirmModal, MultiChips, PageHeader, SingleChips, Toggle, TonePill } from './components';
import { friendlyError, teacherPath } from './labels';

const PAGE_SIZE = 20;
const ALL_CATEGORIES = Object.values(Category);
const ALL_DIFFICULTIES = Object.values(Difficulty);
const ALL_TYPES = Object.values(QuestionType);
const BLANK = '____';

const DIFFICULTY_TONE = { EASY: 'green', MEDIUM: 'yellow', HARD: 'pink' } as const;

const EMPTY_FORM: WordPairInput = {
  word: '',
  opposite: '',
  category: Category.SIZES,
  difficulty: Difficulty.EASY,
  sentence: '',
  sentenceAnswer: 'opposite',
  explanation: '',
  imageable: false,
  wordImage: '',
  oppositeImage: '',
  supportedTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE],
  active: true,
};

type FormErrors = Partial<Record<keyof WordPairInput, string>>;

export function validateWordPair(f: WordPairInput): FormErrors {
  const e: FormErrors = {};
  if (!f.word.trim()) e.word = 'יש להזין מילה';
  if (!f.opposite.trim()) e.opposite = 'יש להזין את ההפך';
  if (f.word.trim() && f.word.trim() === f.opposite.trim()) e.opposite = 'ההפך חייב להיות שונה מהמילה';
  if (!f.sentence.trim()) e.sentence = 'יש להזין משפט דוגמה';
  else if (!f.sentence.includes(BLANK)) e.sentence = `המשפט חייב להכיל ${BLANK} במקום המילה החסרה`;
  if (f.supportedTypes.length === 0) e.supportedTypes = 'יש לבחור לפחות סוג שאלה אחד';
  if (f.imageable) {
    if (!f.wordImage?.trim()) e.wordImage = 'יש להזין נתיב תמונה למילה';
    if (!f.oppositeImage?.trim()) e.oppositeImage = 'יש להזין נתיב תמונה להפך';
  } else if (f.supportedTypes.includes(QuestionType.CHOOSE_IMAGE)) {
    e.supportedTypes = '״בחירת תמונה״ דורשת זוג שניתן להמחשה בתמונה';
  }
  return e;
}

export function WordPairsPage() {
  const [items, setItems] = useState<WordPairContent[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>('');
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [editing, setEditing] = useState<WordPairContent | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<WordPairContent | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, difficulty]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await teacherApi.wordPairs.list({ search: debouncedSearch, category, difficulty, page, limit: PAGE_SIZE });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      toast.error(friendlyError(err, 'לא הצלחנו לטעון את המאגר'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, category, difficulty, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    teacherApi.categories.list().then(setCategories).catch(() => setCategories([]));
    teacherApi.media.list().then(setMedia).catch(() => setMedia([]));
  }, []);

  const refreshCategories = () => teacherApi.categories.list().then(setCategories).catch(() => undefined);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const toggleActive = async (pair: WordPairContent) => {
    setTogglingId(pair.id);
    try {
      const updated = await teacherApi.wordPairs.update(pair.id, { active: !pair.active });
      setItems((prev) => prev.map((p) => (p.id === pair.id ? updated : p)));
      toast.success(updated.active ? `״${updated.word}״ הופעל` : `״${updated.word}״ הושבת`);
    } catch (err) {
      toast.error(friendlyError(err, 'העדכון נכשל'));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await teacherApi.wordPairs.remove(toDelete.id);
      toast.success(`הזוג ״${toDelete.word} / ${toDelete.opposite}״ נמחק`);
      await load();
      void refreshCategories();
    } catch (err) {
      toast.error(friendlyError(err, 'המחיקה נכשלה'));
      throw err;
    }
  };

  const categoryCount = (c: Category) => categories.find((x) => x.id === c)?.count;

  return (
    <div>
      <PageHeader
        title="מאגר ההפכים"
        subtitle={`${total.toLocaleString('he-IL')} זוגות במאגר · עריכה, הוספה והשבתה של זוגות מילים.`}
        crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: 'מאגר ההפכים' }]}
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" aria-hidden /> זוג חדש
          </Button>
        }
      />

      <Card className="mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש מילה או הפך…"
            aria-label="חיפוש"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-9 pl-3 text-sm focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | '')}
          aria-label="סינון לפי קטגוריה"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30"
        >
          <option value="">כל הקטגוריות</option>
          {ALL_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
              {categoryCount(c) !== undefined ? ` (${categoryCount(c)})` : ''}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty | '')}
          aria-label="סינון לפי רמת קושי"
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30"
        >
          <option value="">כל הרמות</option>
          {ALL_DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABELS[d]}
            </option>
          ))}
        </select>
      </Card>

      <Card className="overflow-hidden p-0">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <EmptyState title="לא נמצאו זוגות" description="נסו חיפוש אחר, או הוסיפו זוג חדש למאגר." />
          </div>
        ) : (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-right font-medium">מילה</th>
                  <th className="px-4 py-2 text-right font-medium">הפך</th>
                  <th className="px-4 py-2 text-right font-medium">קטגוריה</th>
                  <th className="px-4 py-2 text-right font-medium">קושי</th>
                  <th className="hidden px-4 py-2 text-right font-medium md:table-cell">סוגי שאלות</th>
                  <th className="px-4 py-2 text-right font-medium">תמונה</th>
                  <th className="px-4 py-2 text-right font-medium">פעיל</th>
                  <th className="px-4 py-2 text-right font-medium">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((pair) => (
                  <tr key={pair.id} className={`border-t border-slate-100 hover:bg-slate-50/60 ${pair.active ? '' : 'text-slate-400'}`}>
                    <td className="px-4 py-2.5 font-semibold text-brand-navy">{pair.word}</td>
                    <td className="px-4 py-2.5 font-semibold text-brand-violet">{pair.opposite}</td>
                    <td className="px-4 py-2.5 text-slate-600">{CATEGORY_LABELS[pair.category]}</td>
                    <td className="px-4 py-2.5">
                      <TonePill tone={DIFFICULTY_TONE[pair.difficulty]}>{DIFFICULTY_LABELS[pair.difficulty]}</TonePill>
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {pair.supportedTypes.map((t) => (
                          <TonePill key={t} tone="gray">
                            {QUESTION_TYPE_LABELS[t]}
                          </TonePill>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {pair.imageable ? (
                        <div className="flex items-center gap-1">
                          {pair.wordImage && <img src={pair.wordImage} alt={pair.word} className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-100" loading="lazy" />}
                          {pair.oppositeImage && <img src={pair.oppositeImage} alt={pair.opposite} className="h-8 w-8 rounded-lg object-cover ring-1 ring-slate-100" loading="lazy" />}
                          {!pair.wordImage && !pair.oppositeImage && <ImageIcon className="h-4 w-4 text-slate-300" aria-label="ניתן להמחשה" />}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={pair.active}
                        aria-label={pair.active ? `השבתת ${pair.word}` : `הפעלת ${pair.word}`}
                        disabled={togglingId === pair.id}
                        onClick={() => void toggleActive(pair)}
                        className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors disabled:opacity-50 ${pair.active ? 'bg-brand-green' : 'bg-slate-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${pair.active ? '-translate-x-5' : '-translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => setEditing(pair)} className="rounded-lg p-2 text-slate-400 hover:bg-brand-violet/10 hover:text-brand-violet" aria-label={`עריכת ${pair.word}`}>
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button type="button" onClick={() => setToDelete(pair)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`מחיקת ${pair.word}`}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <span>
              עמוד {page} מתוך {pageCount} · {total.toLocaleString('he-IL')} זוגות
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="md" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} aria-label="עמוד קודם">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
              <Button variant="ghost" size="md" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount || loading} aria-label="עמוד הבא">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {editing !== null && (
        <WordPairModal
          pair={editing === 'new' ? null : editing}
          media={media}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setEditing(null);
            if (isNew) void load();
            else setItems((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            void refreshCategories();
          }}
        />
      )}

      <ConfirmModal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="מחיקת זוג"
        description={
          <>
            למחוק את הזוג <b>{toDelete?.word}</b> / <b>{toDelete?.opposite}</b>? הזוג לא יופיע יותר במשחקים חדשים.
          </>
        }
        confirmLabel="מחיקה"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function toForm(pair: WordPairContent | null): WordPairInput {
  if (!pair) return { ...EMPTY_FORM, supportedTypes: [...EMPTY_FORM.supportedTypes] };
  return {
    word: pair.word,
    opposite: pair.opposite,
    category: pair.category,
    difficulty: pair.difficulty,
    sentence: pair.sentence,
    sentenceAnswer: pair.sentenceAnswer,
    explanation: pair.explanation ?? '',
    imageable: pair.imageable,
    wordImage: pair.wordImage ?? '',
    oppositeImage: pair.oppositeImage ?? '',
    supportedTypes: [...pair.supportedTypes],
    active: pair.active,
  };
}

function WordPairModal({
  pair,
  media,
  onClose,
  onSaved,
}: {
  pair: WordPairContent | null;
  media: MediaItem[];
  onClose: () => void;
  onSaved: (saved: WordPairContent, isNew: boolean) => void;
}) {
  const [form, setForm] = useState<WordPairInput>(() => toForm(pair));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const isNew = pair === null;

  const patch = <K extends keyof WordPairInput>(key: K, value: WordPairInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const imageOptions = useMemo(() => media.filter((m) => m.kind === 'image' || /\.(svg|png|jpe?g|webp)$/i.test(m.url)), [media]);

  const preview = form.sentence.includes(BLANK) ? form.sentence.replace(BLANK, `[${form.sentenceAnswer === 'word' ? form.word || '…' : form.opposite || '…'}]`) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload: WordPairInput = {
      ...form,
      word: form.word.trim(),
      opposite: form.opposite.trim(),
      sentence: form.sentence.trim(),
      explanation: form.explanation?.trim() || undefined,
      wordImage: form.imageable ? form.wordImage?.trim() || undefined : undefined,
      oppositeImage: form.imageable ? form.oppositeImage?.trim() || undefined : undefined,
      supportedTypes: ALL_TYPES.filter((t) => form.supportedTypes.includes(t)),
    };
    const nextErrors = validateWordPair({ ...payload, wordImage: payload.wordImage ?? '', oppositeImage: payload.oppositeImage ?? '' });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      const saved = isNew ? await teacherApi.wordPairs.create(payload) : await teacherApi.wordPairs.update(pair.id, payload);
      toast.success(isNew ? 'הזוג נוסף למאגר' : 'הזוג עודכן');
      onSaved(saved, isNew);
    } catch (err) {
      toast.error(friendlyError(err, 'השמירה נכשלה'));
      setSaving(false);
    }
  };

  const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/30';

  return (
    <Modal open onClose={saving ? () => undefined : onClose} title={isNew ? 'זוג חדש' : `עריכה: ${pair.word} / ${pair.opposite}`}>
      <form onSubmit={handleSubmit} noValidate className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto px-1" aria-label="טופס זוג מילים">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="מילה" name="word" value={form.word} onChange={(e) => patch('word', e.target.value)} error={errors.word} required />
          <Input label="ההפך" name="opposite" value={form.opposite} onChange={(e) => patch('opposite', e.target.value)} error={errors.opposite} required />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-brand-navy">קטגוריה</span>
            <select value={form.category} onChange={(e) => patch('category', e.target.value as Category)} className={fieldClass}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-brand-navy">רמת קושי</span>
            <SingleChips name="רמת קושי" size="sm" options={ALL_DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))} value={form.difficulty} onChange={(v) => patch('difficulty', v)} />
          </div>
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="wp-sentence" className="font-medium text-brand-navy">
            משפט דוגמה <span className="font-normal text-slate-400">(עם {BLANK} במקום המילה החסרה)</span>
          </label>
          <textarea id="wp-sentence" rows={2} value={form.sentence} onChange={(e) => patch('sentence', e.target.value)} className={fieldClass} placeholder={`לדוגמה: הפיל ${BLANK} והעכבר קטן.`} />
          {errors.sentence && (
            <p role="alert" className="text-xs text-red-600">
              {errors.sentence}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">המילה שמשלימה את המשפט:</span>
            <SingleChips
              name="תשובת המשפט"
              size="sm"
              options={[
                { value: 'word', label: `המילה (${form.word || 'מילה'})` },
                { value: 'opposite', label: `ההפך (${form.opposite || 'הפך'})` },
              ]}
              value={form.sentenceAnswer}
              onChange={(v) => patch('sentenceAnswer', v)}
            />
          </div>
          {preview && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">תצוגה: {preview}</p>}
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <label htmlFor="wp-explanation" className="font-medium text-brand-navy">
            הסבר קצר <span className="font-normal text-slate-400">(אופציונלי, מוצג אחרי התשובה)</span>
          </label>
          <textarea id="wp-explanation" rows={2} value={form.explanation ?? ''} onChange={(e) => patch('explanation', e.target.value)} className={fieldClass} />
        </div>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-navy">סוגי שאלות נתמכים</span>
          <MultiChips name="סוגי שאלות" size="sm" options={ALL_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))} value={form.supportedTypes} onChange={(v) => patch('supportedTypes', v)} />
          {errors.supportedTypes && (
            <p role="alert" className="text-xs text-red-600">
              {errors.supportedTypes}
            </p>
          )}
        </div>

        <Toggle name="imageable" checked={form.imageable} onChange={(v) => patch('imageable', v)} label="ניתן להמחשה בתמונה" description="מאפשר שאלות ״בחירת תמונה״ ותמונות בכרטיסי ההתאמה." />

        {form.imageable && (
          <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <ImageField label={`תמונה – ${form.word || 'המילה'}`} name="wordImage" value={form.wordImage ?? ''} onChange={(v) => patch('wordImage', v)} error={errors.wordImage} options={imageOptions} />
            <ImageField label={`תמונה – ${form.opposite || 'ההפך'}`} name="oppositeImage" value={form.oppositeImage ?? ''} onChange={(v) => patch('oppositeImage', v)} error={errors.oppositeImage} options={imageOptions} />
          </div>
        )}

        <Toggle name="active" checked={form.active} onChange={(v) => patch('active', v)} label="פעיל במאגר" description="זוגות לא פעילים לא ייכללו במשחקים חדשים." />

        <div className="sticky bottom-0 flex justify-start gap-2 border-t border-slate-100 bg-white pt-3">
          <Button type="submit" variant="primary" loading={saving} disabled={saving}>
            {isNew ? 'הוספה למאגר' : 'שמירת שינויים'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ImageField({
  label,
  name,
  value,
  onChange,
  error,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  options: MediaItem[];
}) {
  const listId = `media-list-${name}`;
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [value]);
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
        {value && !broken ? (
          <img src={value} alt={label} className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <ImageIcon className="h-6 w-6 text-slate-300" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Input label={label} name={name} dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} error={error ?? (broken && value ? 'התמונה לא נטענה – בדקו את הנתיב' : undefined)} placeholder="/images/pairs/..." list={listId} />
        <datalist id={listId}>
          {options.map((m) => (
            <option key={m.key} value={m.url}>
              {m.alt}
            </option>
          ))}
        </datalist>
      </div>
    </div>
  );
}

export default WordPairsPage;
