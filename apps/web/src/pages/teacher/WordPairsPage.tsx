import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
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
import { cn } from '@/lib/cn';
import { teacherApi, type CategoryInfo, type MediaItem, type WordPairInput } from '@/services/teacherApi';
import { BLANK, EMPTY_FORM, validateWordPair, type WordPairFormErrors as FormErrors } from './wordPairForm';
import { ConfirmModal, MultiChips, PageHeader, SegmentedTabs, SingleChips, Toggle, TonePill } from './components';
import { friendlyError, teacherPath } from './labels';

const PAGE_SIZE = 20;
const ALL_CATEGORIES = Object.values(Category);
const ALL_DIFFICULTIES = Object.values(Difficulty);
const ALL_TYPES = Object.values(QuestionType);

const DIFFICULTY_TONE = { EASY: 'green', MEDIUM: 'yellow', HARD: 'pink' } as const;

export function WordPairsPage() {
  const reduce = useReducedMotion();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategoryState] = useState<Category | ''>('');
  const [difficulty, setDifficultyState] = useState<Difficulty | ''>('');
  const [reloadTick, setReloadTick] = useState(0);
  const queryKey = JSON.stringify({ debouncedSearch, category, difficulty, page, reloadTick });
  const [listState, setListState] = useState<{ key: string; items: WordPairContent[]; total: number } | null>(null);
  const items = listState?.items ?? [];
  const total = listState?.total ?? 0;
  const loading = listState?.key !== queryKey;
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [editing, setEditing] = useState<WordPairContent | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<WordPairContent | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = search.trim();
        if (next !== prev) setPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const setCategory = (c: Category | '') => {
    setCategoryState(c);
    setPage(1);
  };
  const setDifficulty = (d: Difficulty | '') => {
    setDifficultyState(d);
    setPage(1);
  };

  useEffect(() => {
    let cancelled = false;
    teacherApi.wordPairs
      .list({ search: debouncedSearch, category, difficulty, page, limit: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) setListState({ key: queryKey, items: res.items, total: res.total });
      })
      .catch((err: unknown) => {
        if (!cancelled) toast.error(friendlyError(err, 'לא הצלחנו לטעון את המאגר'));
      });
    return () => {
      cancelled = true;
    };
    // queryKey מקפל את כל הפרמטרים
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  const load = useCallback(() => setReloadTick((t) => t + 1), []);
  const setItems = (updater: (items: WordPairContent[]) => WordPairContent[]) => setListState((prev) => (prev ? { ...prev, items: updater(prev.items) } : prev));

  useEffect(() => {
    teacherApi.categories.list().then(setCategories).catch(() => setCategories([]));
    teacherApi.media.list().then(setMedia).catch(() => setMedia([]));
  }, []);

  const refreshCategories = () => teacherApi.categories.list().then(setCategories).catch(() => undefined);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

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
      load();
      void refreshCategories();
    } catch (err) {
      toast.error(friendlyError(err, 'המחיקה נכשלה'));
      throw err;
    }
  };

  const categoryCount = (c: Category) => categories.find((x) => x.id === c)?.count;
  const totalInCatalog = categories.reduce((sum, c) => sum + c.count, 0);
  const hasFilters = Boolean(debouncedSearch || category || difficulty);

  const pagination = total > PAGE_SIZE && (
    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
      <span className="tabular-nums">
        {from}–{to} מתוך {total.toLocaleString('he-IL')}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          aria-label="עמוד קודם"
          className="grid size-10 min-h-0 place-items-center rounded-xl bg-white text-brand-navy ring-1 ring-slate-200 transition-colors hover:bg-violet-50 disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
        <span className="px-2 text-xs font-bold text-brand-navy tabular-nums">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={page >= pageCount || loading}
          aria-label="עמוד הבא"
          className="grid size-10 min-h-0 place-items-center rounded-xl bg-white text-brand-navy ring-1 ring-slate-200 transition-colors hover:bg-violet-50 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        eyebrow="תוכן"
        title="מאגר ההפכים"
        subtitle={`${(totalInCatalog || total).toLocaleString('he-IL')} זוגות במאגר · עריכה, הוספה והשבתה של זוגות מילים.`}
        crumbs={[{ label: 'לוח בקרה', to: teacherPath() }, { label: 'מאגר ההפכים' }]}
        actions={
          <Button variant="primary" size="md" onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> זוג חדש
          </Button>
        }
      />

      {/* סרגל סינון */}
      <Card variant="glass" padding="none" className="mb-4 flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-[18px] -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש מילה או הפך…"
              aria-label="חיפוש"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white/90 py-2 pe-10 ps-11 text-sm font-medium shadow-sm transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-brand-violet focus:outline-none focus:ring-4 focus:ring-brand-violet/20"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} aria-label="ניקוי החיפוש" className="absolute end-2 top-1/2 grid size-8 min-h-0 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
          <SegmentedTabs
            label="סינון לפי רמת קושי"
            value={difficulty || 'ALL'}
            onChange={(v) => setDifficulty(v === 'ALL' ? '' : (v as Difficulty))}
            options={[{ value: 'ALL', label: 'כל הרמות' }, ...ALL_DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))]}
          />
        </div>
        <div className="-mx-3 overflow-x-auto px-3 pb-0.5 [scrollbar-width:thin] sm:-mx-4 sm:px-4" role="group" aria-label="סינון לפי קטגוריה">
          <div className="flex w-max gap-1.5">
            <FilterPill active={category === ''} onClick={() => setCategory('')}>
              כל הקטגוריות
            </FilterPill>
            {ALL_CATEGORIES.map((c) => (
              <FilterPill key={c} active={category === c} onClick={() => setCategory(c)} count={categoryCount(c)}>
                {CATEGORY_LABELS[c]}
              </FilterPill>
            ))}
          </div>
        </div>
      </Card>

      <Card variant="glass" padding="none" className="overflow-hidden p-0">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner className="text-brand-violet" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title="לא נמצאו זוגות"
              description={hasFilters ? 'נסו חיפוש אחר או נקו את הסינון.' : 'הוסיפו את הזוג הראשון למאגר.'}
              className="bg-transparent"
              action={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setSearch('');
                      setCategory('');
                      setDifficulty('');
                    }}
                  >
                    ניקוי הסינון
                  </Button>
                ) : (
                  <Button variant="primary" size="md" onClick={() => setEditing('new')}>
                    <Plus className="size-4" aria-hidden /> זוג חדש
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <div className={cn('transition-opacity', loading && 'opacity-60')}>
            {/* טבלה – טאבלט ומעלה */}
            <div className="hidden max-h-[70vh] overflow-auto md:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-xs font-bold text-slate-500 shadow-[0_1px_0_rgba(226,232,240,1)] backdrop-blur">
                  <tr>
                    <th className="px-5 py-3 text-start">מילה</th>
                    <th className="px-4 py-3 text-start">הפך</th>
                    <th className="px-4 py-3 text-start">קטגוריה</th>
                    <th className="px-4 py-3 text-start">קושי</th>
                    <th className="hidden px-4 py-3 text-start lg:table-cell">סוגי שאלות</th>
                    <th className="px-4 py-3 text-start">תמונה</th>
                    <th className="px-4 py-3 text-start">פעיל</th>
                    <th className="px-4 py-3 text-start">
                      <span className="sr-only">פעולות</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((pair) => (
                    <tr key={pair.id} className={cn('group border-t border-slate-100 transition-colors odd:bg-white/40 even:bg-slate-50/40 hover:bg-violet-50/50', !pair.active && 'text-slate-400')}>
                      <td className="px-5 py-2.5 text-base font-extrabold text-brand-navy">{pair.word}</td>
                      <td className="px-4 py-2.5 text-base font-extrabold text-brand-violet">{pair.opposite}</td>
                      <td className="px-4 py-2.5 text-slate-600">{CATEGORY_LABELS[pair.category]}</td>
                      <td className="px-4 py-2.5">
                        <TonePill tone={DIFFICULTY_TONE[pair.difficulty]}>{DIFFICULTY_LABELS[pair.difficulty]}</TonePill>
                      </td>
                      <td className="hidden px-4 py-2.5 lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {pair.supportedTypes.map((t) => (
                            <TonePill key={t} tone="gray">
                              {QUESTION_TYPE_LABELS[t]}
                            </TonePill>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Thumbs pair={pair} />
                      </td>
                      <td className="px-4 py-2.5">
                        <ActiveSwitch pair={pair} busy={togglingId === pair.id} onToggle={() => void toggleActive(pair)} />
                      </td>
                      <td className="px-4 py-2.5">
                        <RowActions pair={pair} onEdit={() => setEditing(pair)} onDelete={() => setToDelete(pair)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* כרטיסים – נייד */}
            <ul className="flex flex-col gap-2 p-3 md:hidden" aria-label="רשימת זוגות">
              {items.map((pair, i) => (
                <motion.li
                  key={pair.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03 }}
                  className={cn('rounded-2xl bg-white/85 p-3 ring-1 ring-slate-100', !pair.active && 'opacity-70')}
                >
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-base font-extrabold">
                        <span className="text-brand-navy">{pair.word}</span>
                        <span className="text-xs font-normal text-slate-400">⇄</span>
                        <span className="text-brand-violet">{pair.opposite}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <TonePill tone="sky">{CATEGORY_LABELS[pair.category]}</TonePill>
                        <TonePill tone={DIFFICULTY_TONE[pair.difficulty]}>{DIFFICULTY_LABELS[pair.difficulty]}</TonePill>
                      </div>
                    </div>
                    <Thumbs pair={pair} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <ActiveSwitch pair={pair} busy={togglingId === pair.id} onToggle={() => void toggleActive(pair)} withLabel />
                    <RowActions pair={pair} onEdit={() => setEditing(pair)} onDelete={() => setToDelete(pair)} />
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        )}
        {pagination}
      </Card>

      {editing !== null && (
        <WordPairModal
          pair={editing === 'new' ? null : editing}
          media={media}
          onClose={() => setEditing(null)}
          onSaved={(saved, isNew) => {
            setEditing(null);
            if (isNew) load();
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

function FilterPill({ active, onClick, count, children }: { active: boolean; onClick: () => void; count?: number; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-0 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-[background-color,color,box-shadow] duration-200',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-violet/30',
        active
          ? 'bg-linear-to-b from-violet-500 to-violet-600 text-white shadow-[0_6px_14px_-6px_rgba(139,92,246,.8),inset_0_1px_0_rgba(255,255,255,.35)]'
          : 'bg-white text-slate-600 ring-1 ring-slate-200/90 hover:text-brand-violet hover:ring-violet-300',
      )}
    >
      {children}
      {count !== undefined && <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', active ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>{count}</span>}
    </button>
  );
}

function Thumbs({ pair }: { pair: WordPairContent }) {
  if (!pair.imageable) return <span className="text-xs text-slate-300">—</span>;
  return (
    <div className="flex items-center gap-1">
      {pair.wordImage && <img src={pair.wordImage} alt={pair.word} className="size-9 rounded-xl bg-white object-cover shadow-sm ring-1 ring-slate-100" loading="lazy" />}
      {pair.oppositeImage && <img src={pair.oppositeImage} alt={pair.opposite} className="size-9 rounded-xl bg-white object-cover shadow-sm ring-1 ring-slate-100" loading="lazy" />}
      {!pair.wordImage && !pair.oppositeImage && (
        <span className="grid size-9 place-items-center rounded-xl bg-slate-50 ring-1 ring-slate-100" title="ניתן להמחשה – אין תמונה">
          <ImageIcon className="size-4 text-slate-300" aria-label="ניתן להמחשה" />
        </span>
      )}
    </div>
  );
}

function ActiveSwitch({ pair, busy, onToggle, withLabel }: { pair: WordPairContent; busy: boolean; onToggle: () => void; withLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={pair.active}
        aria-label={pair.active ? `השבתת ${pair.word}` : `הפעלת ${pair.word}`}
        disabled={busy}
        onClick={onToggle}
        className={cn(
          'relative inline-flex h-6 w-11 min-h-0 shrink-0 items-center rounded-full p-0.5 shadow-[inset_0_2px_4px_rgba(30,41,59,.18)] transition-colors disabled:opacity-50',
          pair.active ? 'bg-linear-to-b from-emerald-400 to-green-500' : 'bg-slate-300',
        )}
      >
        <span className={cn('block size-5 rounded-full bg-white shadow-[0_1px_3px_rgba(30,41,59,.35)] transition-[margin]', pair.active ? 'ms-auto' : 'me-auto')} />
      </button>
      {withLabel && <span className="text-xs font-semibold text-slate-500">{pair.active ? 'פעיל' : 'מושבת'}</span>}
    </span>
  );
}

function RowActions({ pair, onEdit, onDelete }: { pair: WordPairContent; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <button type="button" onClick={onEdit} className="grid size-9 min-h-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-violet-100 hover:text-brand-violet" aria-label={`עריכת ${pair.word}`} title="עריכה">
        <Pencil className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={onDelete} className="grid size-9 min-h-0 place-items-center rounded-xl text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600" aria-label={`מחיקת ${pair.word}`} title="מחיקה">
        <Trash2 className="size-4" aria-hidden />
      </button>
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

const fieldClass =
  'w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] focus:border-brand-violet focus:outline-none focus:ring-4 focus:ring-brand-violet/20';

function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
      <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function WordPairModal({ pair, media, onClose, onSaved }: { pair: WordPairContent | null; media: MediaItem[]; onClose: () => void; onSaved: (saved: WordPairContent, isNew: boolean) => void }) {
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

  return (
    <Modal open size="lg" dismissible={!saving} onClose={onClose} title={isNew ? 'זוג חדש' : `עריכה: ${pair.word} / ${pair.opposite}`}>
      <form onSubmit={handleSubmit} noValidate className="-mx-1 flex max-h-[72vh] flex-col gap-4 overflow-y-auto px-1 pb-1 text-base" aria-label="טופס זוג מילים">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="מילה" name="word" size="md" value={form.word} onChange={(e) => patch('word', e.target.value)} error={errors.word} required />
          <Input label="ההפך" name="opposite" size="md" value={form.opposite} onChange={(e) => patch('opposite', e.target.value)} error={errors.opposite} required />
        </div>

        <FormGroup title="סיווג">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-bold text-brand-navy">קטגוריה</span>
              <select value={form.category} onChange={(e) => patch('category', e.target.value as Category)} className={fieldClass}>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1.5 text-sm">
              <span className="font-bold text-brand-navy">רמת קושי</span>
              <SingleChips name="רמת קושי" size="sm" options={ALL_DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }))} value={form.difficulty} onChange={(v) => patch('difficulty', v)} />
            </div>
          </div>
        </FormGroup>

        <FormGroup title="משפט דוגמה">
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="wp-sentence" className="font-bold text-brand-navy">
              משפט <span className="font-normal text-slate-400">(עם {BLANK} במקום המילה החסרה)</span>
            </label>
            <textarea id="wp-sentence" rows={2} value={form.sentence} onChange={(e) => patch('sentence', e.target.value)} className={fieldClass} placeholder={`לדוגמה: הפיל ${BLANK} והעכבר קטן.`} />
            {errors.sentence && (
              <p role="alert" className="text-xs font-semibold text-rose-600">
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
            {preview && <p className="rounded-xl bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">תצוגה: {preview}</p>}
          </div>
          <div className="flex flex-col gap-1.5 text-sm">
            <label htmlFor="wp-explanation" className="font-bold text-brand-navy">
              הסבר קצר <span className="font-normal text-slate-400">(אופציונלי, מוצג אחרי התשובה)</span>
            </label>
            <textarea id="wp-explanation" rows={2} value={form.explanation ?? ''} onChange={(e) => patch('explanation', e.target.value)} className={fieldClass} />
          </div>
        </FormGroup>

        <FormGroup title="שימוש במשחק">
          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-bold text-brand-navy">סוגי שאלות נתמכים</span>
            <MultiChips name="סוגי שאלות" size="sm" options={ALL_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))} value={form.supportedTypes} onChange={(v) => patch('supportedTypes', v)} />
            {errors.supportedTypes && (
              <p role="alert" className="text-xs font-semibold text-rose-600">
                {errors.supportedTypes}
              </p>
            )}
          </div>
          <Toggle name="imageable" checked={form.imageable} onChange={(v) => patch('imageable', v)} icon={<ImageIcon className="size-4" aria-hidden />} label="ניתן להמחשה בתמונה" description="מאפשר שאלות ״בחירת תמונה״ ותמונות בכרטיסי ההתאמה." />
          {form.imageable && (
            <div className="grid gap-4 rounded-2xl bg-white p-4 ring-1 ring-slate-100 sm:grid-cols-2">
              <ImageField label={`תמונה – ${form.word || 'המילה'}`} name="wordImage" value={form.wordImage ?? ''} onChange={(v) => patch('wordImage', v)} error={errors.wordImage} options={imageOptions} />
              <ImageField label={`תמונה – ${form.opposite || 'ההפך'}`} name="oppositeImage" value={form.oppositeImage ?? ''} onChange={(v) => patch('oppositeImage', v)} error={errors.oppositeImage} options={imageOptions} />
            </div>
          )}
          <Toggle name="active" checked={form.active} onChange={(v) => patch('active', v)} label="פעיל במאגר" description="זוגות לא פעילים לא ייכללו במשחקים חדשים." />
        </FormGroup>

        <div className="sticky bottom-0 -mx-1 flex flex-wrap justify-start gap-2 border-t border-slate-100 bg-white/95 px-1 pt-3 backdrop-blur">
          <Button type="submit" variant="primary" size="md" loading={saving} disabled={saving}>
            {isNew ? 'הוספה למאגר' : 'שמירת שינויים'}
          </Button>
          <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ImageField({ label, name, value, onChange, error, options }: { label: string; name: string; value: string; onChange: (v: string) => void; error?: string; options: MediaItem[] }) {
  const listId = `media-list-${name}`;
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const broken = brokenSrc !== null && brokenSrc === value;
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-200">
        {value && !broken ? <img src={value} alt={label} className="size-full object-cover" onError={() => setBrokenSrc(value)} /> : <ImageIcon className="size-6 text-slate-300" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <Input
          label={label}
          name={name}
          size="md"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          error={error ?? (broken && value ? 'התמונה לא נטענה – בדקו את הנתיב' : undefined)}
          placeholder="/images/pairs/..."
          list={listId}
        />
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
