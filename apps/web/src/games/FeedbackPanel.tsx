import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Flame, Lightbulb, PartyPopper, Smile, Clock } from 'lucide-react';
import type { AnswerResult } from '@oc/shared';
import { Button, ScoreBadge, cn } from './_ui';

export type FeedbackKind = 'correct' | 'wrong' | 'timeout';

export interface FeedbackPanelProps {
  kind: FeedbackKind | null;
  result?: AnswerResult | null;
  /** טקסט התשובה הנכונה (מוצג רק אם showCorrectAnswers) */
  correctText?: string | null;
  explanation?: string | null;
  onNext: () => void;
  nextLabel?: string;
}

const ENCOURAGE_WRONG = ['לא נורא, בפעם הבאה!', 'כמעט! ממשיכים קדימה 💪', 'יופי שניסית! עוד מעט זה יצליח'];
const PRAISE = ['כל הכבוד!', 'מעולה!', 'וואו, אלוף!', 'תשובה מצוינת!'];

export function pick<T>(arr: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length] as T;
}

export function FeedbackPanel({ kind, result, correctText, explanation, onNext, nextLabel = 'המשך' }: FeedbackPanelProps) {
  const seed = result?.sessionQuestionId ?? 'x';
  return (
    <AnimatePresence>
      {kind && (
        <motion.section
          key={kind}
          role="status"
          aria-live="polite"
          data-testid="feedback-panel"
          data-kind={kind}
          initial={{ y: 24, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className={cn(
            'rounded-3xl px-4 py-4 text-center shadow-lg ring-4 sm:px-6',
            kind === 'correct' && 'bg-green-50 ring-green-200',
            kind === 'wrong' && 'bg-orange-50 ring-orange-200',
            kind === 'timeout' && 'bg-sky-50 ring-sky-200',
          )}
        >
          <div className="flex flex-col items-center gap-2">
            {kind === 'correct' && (
              <>
                <p className="flex items-center gap-2 text-3xl font-black text-green-700 sm:text-4xl">
                  <PartyPopper className="h-8 w-8" aria-hidden="true" />
                  {kind === 'correct' ? pick(PRAISE, seed) : null}
                </p>
                {result && <ScoreBadge points={result.scoreAwarded} />}
                {result && result.streak >= 2 && (
                  <p className="flex items-center gap-1 text-lg font-bold text-orange-600">
                    <Flame className="h-5 w-5" aria-hidden="true" />
                    {result.streak} ברצף!
                  </p>
                )}
              </>
            )}
            {kind === 'wrong' && (
              <>
                <p className="flex items-center gap-2 text-2xl font-black text-orange-700 sm:text-3xl">
                  <Smile className="h-8 w-8" aria-hidden="true" />
                  {pick(ENCOURAGE_WRONG, seed)}
                </p>
                {correctText && (
                  <p className="text-xl font-bold text-slate-700" data-testid="correct-answer-text">
                    התשובה הנכונה: <span className="rounded-lg bg-green-100 px-2 text-green-800">{correctText}</span>
                  </p>
                )}
              </>
            )}
            {kind === 'timeout' && (
              <p className="flex items-center gap-2 text-2xl font-black text-sky-700 sm:text-3xl">
                <Clock className="h-8 w-8" aria-hidden="true" />
                נגמר הזמן – לא נורא, ממשיכים!
              </p>
            )}
            {explanation && (
              <p className="mt-1 flex items-start gap-2 rounded-2xl bg-white/80 px-3 py-2 text-base font-semibold text-slate-600 sm:text-lg" data-testid="explanation">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" aria-hidden="true" />
                <span>{explanation}</span>
              </p>
            )}
            <Button
              variant={kind === 'correct' ? 'success' : 'primary'}
              size="xl"
              onClick={onNext}
              className="mt-2 w-full sm:w-auto sm:min-w-64"
              icon={<ArrowLeft className="h-7 w-7" strokeWidth={3} aria-hidden="true" />}
              data-testid="next-button"
            >
              {nextLabel}
            </Button>
            <p className="text-xs font-semibold text-slate-400">אפשר ללחוץ Enter</p>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
