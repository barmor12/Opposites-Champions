import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeftRight, Check, Link2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { MATCH_PAIRS_PER_QUESTION, type AnswerResult, type MatchAnswerPayload, type MatchCardView, type QuestionView } from '@oc/shared';
import { Button, LazyImage } from './_ui';
import { cn, samePair } from './utils';

export interface MatchPairsQuestionProps {
  question: QuestionView;
  result: AnswerResult | null;
  disabled: boolean;
  showCorrectAnswers: boolean;
  onSubmit: (payload: Omit<MatchAnswerPayload, 'sessionQuestionId'>) => void;
  onLink?: () => void;
  onUnlink?: () => void;
}

export interface LinkedPair {
  cardA: string;
  cardB: string;
  color: number;
}

const PAIR_COLORS = [
  { bg: 'bg-sky-100 border-sky-400 text-sky-900', badge: 'bg-sky-500 text-white' },
  { bg: 'bg-violet-100 border-violet-400 text-violet-900', badge: 'bg-violet-500 text-white' },
  { bg: 'bg-yellow-100 border-yellow-400 text-yellow-900', badge: 'bg-yellow-400 text-yellow-900' },
  { bg: 'bg-pink-100 border-pink-400 text-pink-900', badge: 'bg-pink-500 text-white' },
  { bg: 'bg-green-100 border-green-400 text-green-900', badge: 'bg-green-500 text-white' },
  { bg: 'bg-orange-100 border-orange-400 text-orange-900', badge: 'bg-orange-500 text-white' },
] as const;

export function MatchPairsQuestion({ question, result, disabled, showCorrectAnswers, onSubmit, onLink, onUnlink }: MatchPairsQuestionProps) {
  const reduced = useReducedMotion();
  const cards = useMemo(() => question.matchCards ?? [], [question.matchCards]);
  const pairsCount = question.matchPairsCount ?? Math.max(1, Math.floor(cards.length / 2)) ?? MATCH_PAIRS_PER_QUESTION;

  const [selected, setSelected] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkedPair[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [flips, setFlips] = useState<Record<string, number>>({});
  const [shaking, setShaking] = useState<string[]>([]);

  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const linkOf = useCallback((id: string) => links.find((l) => l.cardA === id || l.cardB === id) ?? null, [links]);
  const nextColor = useMemo(() => {
    const used = new Set(links.map((l) => l.color));
    for (let i = 0; i < PAIR_COLORS.length; i++) if (!used.has(i)) return i;
    return links.length % PAIR_COLORS.length;
  }, [links]);

  const complete = links.length >= pairsCount;

  const handleTap = (card: MatchCardView) => {
    if (disabled || result) return;
    const existing = linkOf(card.id);
    if (existing) {
      // unlink – allow the student to change their mind (counts as a mistake)
      setLinks((ls) => ls.filter((l) => l !== existing));
      setMistakes((m) => m + 1);
      setShaking([existing.cardA, existing.cardB]);
      setTimeout(() => setShaking([]), 500);
      setSelected(null);
      onUnlink?.();
      return;
    }
    if (selected === null) {
      setSelected(card.id);
      return;
    }
    if (selected === card.id) {
      setSelected(null);
      return;
    }
    const pair: LinkedPair = { cardA: selected, cardB: card.id, color: nextColor };
    setLinks((ls) => [...ls, pair]);
    setFlips((f) => ({ ...f, [pair.cardA]: (f[pair.cardA] ?? 0) + 1, [pair.cardB]: (f[pair.cardB] ?? 0) + 1 }));
    setSelected(null);
    onLink?.();
  };

  const submit = () => {
    if (!complete || disabled || result) return;
    onSubmit({ matches: links.map(({ cardA, cardB }) => ({ cardA, cardB })), mistakes });
  };

  // ----- result helpers -----
  const linkCorrect = (l: LinkedPair): boolean | null => {
    if (!result) return null;
    if (result.correctMatches) return result.correctMatches.some((c) => samePair(c, l));
    return result.correct;
  };
  const correctCount = result ? links.filter((l) => linkCorrect(l)).length : 0;
  const missedPairs =
    result && showCorrectAnswers && result.correctMatches
      ? result.correctMatches.filter((c) => !links.some((l) => samePair(l, c) && linkCorrect(l)))
      : [];

  return (
    <div className="flex flex-col gap-4" data-testid="match-pairs">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/80 px-4 py-2 text-slate-700 shadow-sm">
        <p className="flex items-center gap-2 text-base font-bold sm:text-lg">
          <ArrowLeftRight className="h-5 w-5 text-violet-500" aria-hidden="true" />
          {result
            ? `${correctCount} מתוך ${pairsCount} זוגות נכונים`
            : selected
              ? 'עכשיו לחצו על ההפך שלה'
              : 'לחצו על מילה, ואז על ההפך שלה'}
        </p>
        <div className="flex items-center gap-1" aria-label={`זוגות שחוברו: ${links.length} מתוך ${pairsCount}`} role="img">
          {Array.from({ length: pairsCount }, (_, i) => {
            const l = links[i];
            const ok = l ? linkCorrect(l) : null;
            return (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  'h-4 w-4 rounded-full border-2 transition-colors',
                  !l && 'border-slate-300 bg-slate-100',
                  l && ok === null && 'border-violet-500 bg-violet-400',
                  l && ok === true && 'border-green-600 bg-green-500',
                  l && ok === false && 'border-red-500 bg-red-400',
                )}
              />
            );
          })}
          <span className="ms-1 text-sm font-bold text-slate-500">
            {links.length}/{pairsCount}
          </span>
        </div>
      </div>

      <ul
        role="list"
        aria-label="קלפים"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
      >
        {cards.map((card, i) => {
          const link = linkOf(card.id);
          const isSelected = selected === card.id;
          const ok = link ? linkCorrect(link) : null;
          const color = link ? PAIR_COLORS[link.color % PAIR_COLORS.length] ?? PAIR_COLORS[0] : null;
          const pairIndex = link ? links.indexOf(link) + 1 : null;
          const flipCount = flips[card.id] ?? 0;
          const isShaking = shaking.includes(card.id);
          const stateLabel = ok === true ? ' – זוג נכון' : ok === false ? ' – זוג שגוי' : link ? ` – מחובר בזוג ${pairIndex}` : isSelected ? ' – נבחר' : '';
          return (
            <li key={card.id} className="[perspective:900px]">
              <motion.button
                type="button"
                onClick={() => handleTap(card)}
                disabled={disabled && !result}
                aria-disabled={disabled || !!result}
                aria-pressed={isSelected || !!link}
                data-testid={`card-${i + 1}`}
                data-card-id={card.id}
                data-linked={link ? 'true' : 'false'}
                data-result={ok === null ? '' : ok ? 'correct' : 'wrong'}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: 1,
                  rotateY: reduced ? 0 : flipCount * 360,
                  scale: isSelected ? 1.06 : 1,
                  x: isShaking && !reduced ? [0, -8, 8, -6, 6, 0] : 0,
                }}
                transition={{ rotateY: { duration: 0.6, ease: 'easeInOut' }, x: { duration: 0.45 }, scale: { type: 'spring', stiffness: 300, damping: 18 }, delay: 0.04 * i }}
                whileHover={!disabled && !result && !reduced ? { y: -3 } : undefined}
                whileTap={!disabled && !result && !reduced ? { scale: 0.95 } : undefined}
                className={cn(
                  'relative flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-3xl border-4 px-2 py-3 text-xl font-black transition-colors sm:min-h-32 sm:text-2xl',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed',
                  !link && !isSelected && 'border-slate-200 bg-white text-slate-800 shadow-md hover:border-violet-300',
                  isSelected && 'border-violet-500 bg-violet-50 text-violet-900 ring-4 ring-violet-300',
                  link && ok === null && color?.bg,
                  ok === true && 'border-green-600 bg-green-500 text-white',
                  ok === false && 'border-red-500 bg-red-400 text-white',
                )}
              >
                {link && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black shadow',
                      ok === null ? color?.badge : 'bg-white/90 text-slate-800',
                    )}
                  >
                    {ok === true ? <Check className="h-4 w-4 text-green-600" strokeWidth={4} /> : ok === false ? <X className="h-4 w-4 text-red-500" strokeWidth={4} /> : pairIndex}
                  </span>
                )}
                {link && ok === null && (
                  <Link2 aria-hidden="true" className="absolute left-2 top-2 h-5 w-5 opacity-60" />
                )}
                {card.image && (
                  <LazyImage src={card.image} alt="" className="h-14 w-14 rounded-xl bg-white/60 sm:h-20 sm:w-20" imgClassName="p-1" />
                )}
                <span>
                  {card.text}
                  <span className="sr-only">{stateLabel}</span>
                </span>
              </motion.button>
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {!result && complete && (
          <motion.div
            key="check"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center"
          >
            <Button variant="success" size="xl" onClick={submit} disabled={disabled} className="w-full sm:w-auto sm:min-w-64" icon={<Check className="h-7 w-7" strokeWidth={3.5} aria-hidden="true" />} data-testid="check-button">
              בדיקה
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {result && missedPairs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm"
          data-testid="correct-pairs"
        >
          <p className="mb-2 text-base font-bold text-slate-600">הזוגות הנכונים:</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {missedPairs.map((p) => (
              <li key={`${p.cardA}-${p.cardB}`} className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-lg font-black text-green-800">
                <span>{cardById.get(p.cardA)?.text ?? '?'}</span>
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                <span>{cardById.get(p.cardB)?.text ?? '?'}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </div>
  );
}
