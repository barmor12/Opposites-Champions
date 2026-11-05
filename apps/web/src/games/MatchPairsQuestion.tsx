import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeftRight, Check, Link2, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { MATCH_PAIRS_PER_QUESTION, type AnswerResult, type MatchAnswerPayload, type MatchCardView, type QuestionView } from '@oc/shared';
import { Button, LazyImage } from './_ui';
import { FlipCard } from './FlipCard';
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

/** צבעי זוג – צד אחורי של הקלף */
const PAIR_COLORS = [
  { face: 'from-sky-300 via-sky-400 to-sky-600 text-white border-sky-800', badge: 'bg-white text-sky-700' },
  { face: 'from-violet-300 via-violet-400 to-violet-700 text-white border-violet-900', badge: 'bg-white text-violet-700' },
  { face: 'from-yellow-200 via-amber-300 to-amber-500 text-amber-950 border-amber-700', badge: 'bg-white text-amber-700' },
  { face: 'from-pink-300 via-pink-400 to-pink-600 text-white border-pink-800', badge: 'bg-white text-pink-700' },
  { face: 'from-green-300 via-green-400 to-green-600 text-white border-green-800', badge: 'bg-white text-green-700' },
  { face: 'from-orange-300 via-orange-400 to-orange-600 text-white border-orange-800', badge: 'bg-white text-orange-700' },
] as const;

export function MatchPairsQuestion({ question, result, disabled, showCorrectAnswers, onSubmit, onLink, onUnlink }: MatchPairsQuestionProps) {
  const reduced = useReducedMotion();
  const cards = useMemo(() => question.matchCards ?? [], [question.matchCards]);
  const pairsCount = question.matchPairsCount ?? Math.max(1, Math.floor(cards.length / 2)) ?? MATCH_PAIRS_PER_QUESTION;

  const [selected, setSelected] = useState<string | null>(null);
  const [links, setLinks] = useState<LinkedPair[]>([]);
  const [mistakes, setMistakes] = useState(0);
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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl glass px-4 py-2.5 text-slate-700">
        <p className="flex items-center gap-2 text-base font-bold sm:text-lg">
          <ArrowLeftRight className="h-5 w-5 text-violet-500" aria-hidden="true" />
          {result
            ? `${correctCount} מתוך ${pairsCount} זוגות נכונים`
            : selected
              ? 'עכשיו לחצו על ההפך שלה'
              : 'לחצו על מילה, ואז על ההפך שלה'}
        </p>
        <div className="flex items-center gap-1.5" aria-label={`זוגות שחוברו: ${links.length} מתוך ${pairsCount}`} role="img">
          {Array.from({ length: pairsCount }, (_, i) => {
            const l = links[i];
            const ok = l ? linkCorrect(l) : null;
            return (
              <span
                key={i}
                aria-hidden="true"
                className={cn(
                  'h-4 w-4 rounded-full border-2 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
                  !l && 'border-slate-300 bg-slate-100',
                  l && ok === null && 'border-violet-600 bg-gradient-to-b from-violet-300 to-violet-500',
                  l && ok === true && 'border-green-700 bg-gradient-to-b from-green-300 to-green-500',
                  l && ok === false && 'border-red-600 bg-gradient-to-b from-red-300 to-red-500',
                )}
              />
            );
          })}
          <span className="ms-1 text-sm font-bold text-slate-500" dir="ltr">
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
          const isShaking = shaking.includes(card.id);
          const interactive = !disabled && !result;
          const stateLabel = ok === true ? ' – זוג נכון' : ok === false ? ' – זוג שגוי' : link ? ` – מחובר בזוג ${pairIndex}` : isSelected ? ' – נבחר' : '';

          const content = (
            <>
              {card.image && (
                <LazyImage src={card.image} alt="" glossy className="h-14 w-14 sm:h-20 sm:w-20" imgClassName="p-1" />
              )}
              <span className="relative">{card.text}</span>
            </>
          );

          return (
            <li key={card.id}>
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
                  scale: isSelected ? 1.05 : 1,
                  x: isShaking && !reduced ? [0, -8, 8, -6, 6, 0] : 0,
                }}
                transition={{ x: { duration: 0.45 }, scale: { type: 'spring', stiffness: 300, damping: 18 }, delay: 0.04 * i }}
                whileHover={interactive && !reduced ? { y: -4 } : undefined}
                whileTap={interactive && !reduced ? { scale: 0.96 } : undefined}
                className={cn(
                  'group relative block min-h-24 w-full rounded-3xl text-xl font-black sm:min-h-32 sm:text-2xl lg:min-h-36',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed',
                )}
              >
                <FlipCard
                  flipped={!!link && !reduced}
                  tilt={interactive}
                  className="h-full min-h-[inherit] w-full"
                  front={
                    <span
                      className={cn(
                        'relative flex h-full min-h-[inherit] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl border-b-[6px] bg-gradient-to-b px-2 py-3 transition-[border-color,box-shadow] duration-200',
                        !isSelected && 'from-white to-slate-100 border-slate-300 text-slate-800 shadow-[0_12px_26px_-12px_rgba(30,41,59,0.4),inset_0_2px_0_#fff] group-hover:border-violet-300',
                        isSelected && 'from-violet-50 to-violet-200 border-violet-600 text-violet-900 ring-4 ring-violet-300 shadow-[0_16px_30px_-12px_rgba(109,40,217,0.55),inset_0_2px_0_#fff]',
                        // כשההפחתה פעילה אין היפוך – מציגים צבע זוג/תוצאה גם בפאה הקדמית
                        reduced && link && ok === null && color && `${color.face} ring-0`,
                        reduced && ok === true && 'from-green-400 to-green-600 border-green-800 text-white',
                        reduced && ok === false && 'from-red-400 to-red-600 border-red-800 text-white',
                      )}
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-0 h-[40%] rounded-full bg-gradient-to-b from-white/70 to-transparent" />
                      {reduced && link && (
                        <span aria-hidden="true" className="absolute start-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-sm font-black text-slate-800 shadow">
                          {ok === true ? <Check className="h-4 w-4 text-green-600" strokeWidth={4} /> : ok === false ? <X className="h-4 w-4 text-red-500" strokeWidth={4} /> : pairIndex}
                        </span>
                      )}
                      {content}
                    </span>
                  }
                  back={
                    <span
                      className={cn(
                        'relative flex h-full min-h-[inherit] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-3xl border-b-[6px] bg-gradient-to-b px-2 py-3',
                        'shadow-[0_14px_28px_-12px_rgba(30,41,59,0.45),inset_0_2px_0_rgba(255,255,255,0.5)]',
                        ok === null && (color?.face ?? PAIR_COLORS[0].face),
                        ok === true && 'from-green-400 via-green-500 to-green-700 border-green-900 text-white',
                        ok === false && 'from-red-400 via-red-500 to-red-600 border-red-800 text-white',
                      )}
                    >
                      {/* דוגמת גב הקלף */}
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 pattern-dots opacity-50" />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-2 rounded-2xl border-2 border-white/40" />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-0 h-[40%] rounded-full bg-gradient-to-b from-white/40 to-transparent" />
                      {link && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute start-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black shadow-[0_3px_6px_-1px_rgba(0,0,0,0.3)]',
                            ok === null ? color?.badge : 'bg-white/95 text-slate-800',
                          )}
                        >
                          {ok === true ? <Check className="h-4 w-4 text-green-600" strokeWidth={4} /> : ok === false ? <X className="h-4 w-4 text-red-500" strokeWidth={4} /> : pairIndex}
                        </span>
                      )}
                      {link && ok === null && <Link2 aria-hidden="true" className="absolute end-2 top-2 h-5 w-5 opacity-70" />}
                      <span className="relative drop-shadow-[0_1px_0_rgba(0,0,0,0.2)] contents">{content}</span>
                    </span>
                  }
                />
                <span className="sr-only">
                  {card.text}
                  {stateLabel}
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
            <Button variant="success" size="xl" glow onClick={submit} disabled={disabled} className="w-full sm:w-auto sm:min-w-64" icon={<Check className="h-7 w-7" strokeWidth={3.5} aria-hidden="true" />} data-testid="check-button">
              בדיקה
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {result && missedPairs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl glass px-4 py-3"
          data-testid="correct-pairs"
        >
          <p className="mb-2 text-base font-bold text-slate-600">הזוגות הנכונים:</p>
          <ul className="flex flex-wrap justify-center gap-2">
            {missedPairs.map((p) => (
              <li key={`${p.cardA}-${p.cardB}`} className="flex items-center gap-1 rounded-full bg-gradient-to-b from-green-100 to-green-200 px-3 py-1 text-lg font-black text-green-800 ring-1 ring-green-300 shadow-[inset_0_1px_0_#fff]">
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
