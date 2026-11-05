import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect } from 'react';
import { ArrowLeft, Check, Flame, Lightbulb, PartyPopper, Smile, Clock, X } from 'lucide-react';
import type { AnswerResult } from '@oc/shared';
import { useConfettiBursts } from '@/animations';
import { Button, LazyImage, ScoreBadge } from './_ui';
import { cn, pick } from './utils';

export type FeedbackKind = 'correct' | 'wrong' | 'timeout';

export interface FeedbackPanelProps {
  kind: FeedbackKind | null;
  result?: AnswerResult | null;
  /** טקסט התשובה הנכונה (מוצג רק אם showCorrectAnswers) */
  correctText?: string | null;
  /** איור התשובה הנכונה (מצב תמונות – מוצג רק אם showCorrectAnswers) */
  correctImage?: string | null;
  explanation?: string | null;
  onNext: () => void;
  nextLabel?: string;
  /**
   * `picture` – משוב ללא קריאה: אייקון ✓/✗ ענק, מינימום טקסט, חץ "המשך" גדול.
   * ההסבר הטקסטואלי מוסתר והתשובה הנכונה מוצגת כאיור.
   */
  variant?: 'default' | 'picture';
}

const ENCOURAGE_WRONG = ['לא נורא, בפעם הבאה!', 'כמעט! ממשיכים קדימה 💪', 'יופי שניסית! עוד מעט זה יצליח'];
const ENCOURAGE_WRONG_SHORT = ['לא נורא!', 'כמעט!', 'יופי שניסית!'];
const PRAISE = ['כל הכבוד!', 'מעולה!', 'וואו, אלוף!', 'תשובה מצוינת!'];
const PRAISE_SHORT = ['כל הכבוד!', 'מעולה!', 'אלוף!', 'יש!'];

const PANEL: Record<FeedbackKind, string> = {
  correct: 'from-green-50 via-emerald-50 to-green-100 ring-green-300/80 shadow-[0_24px_50px_-20px_rgba(21,128,61,0.5)]',
  wrong: 'from-orange-50 via-amber-50 to-orange-100 ring-orange-300/80 shadow-[0_24px_50px_-20px_rgba(194,65,12,0.4)]',
  timeout: 'from-sky-50 via-sky-50 to-sky-100 ring-sky-300/80 shadow-[0_24px_50px_-20px_rgba(2,132,199,0.4)]',
};

export function FeedbackPanel({ kind, result, correctText, correctImage, explanation, onNext, nextLabel = 'המשך', variant = 'default' }: FeedbackPanelProps) {
  const seed = result?.sessionQuestionId ?? 'x';
  if (variant === 'picture') {
    return <PictureFeedback kind={kind} result={result} correctText={correctText} correctImage={correctImage} onNext={onNext} nextLabel={nextLabel} seed={seed} />;
  }
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
          className={cn('relative rounded-[2rem] bg-gradient-to-b px-4 py-5 text-center ring-4 sm:px-6 sm:py-6', 'shadow-[inset_0_2px_0_#fff]', PANEL[kind])}
        >
          {kind === 'correct' && <CelebrationBurst />}
          <div className="relative flex flex-col items-center gap-2.5">
            {kind === 'correct' && (
              <>
                <Praise text={pick(PRAISE, seed)} />
                {result && <ScoreBadge points={result.scoreAwarded} />}
                {result && result.streak >= 2 && (
                  <p className="flex items-center gap-1 rounded-full bg-gradient-to-b from-orange-100 to-orange-200 px-3 py-1 text-lg font-bold text-orange-800 ring-1 ring-orange-300 shadow-[inset_0_1px_0_#fff]">
                    <Flame className="h-5 w-5 fill-orange-400 text-orange-600" aria-hidden="true" />
                    {result.streak} ברצף!
                  </p>
                )}
              </>
            )}
            {kind === 'wrong' && (
              <>
                <p className="flex items-center gap-2 text-2xl font-black text-orange-700 text-shadow-pop sm:text-3xl">
                  <Smile className="h-8 w-8" aria-hidden="true" />
                  {pick(ENCOURAGE_WRONG, seed)}
                </p>
                {result && result.scoreAwarded > 0 && <ScoreBadge points={result.scoreAwarded} />}
                {correctText && (
                  <p className="text-xl font-bold text-slate-700" data-testid="correct-answer-text">
                    התשובה הנכונה: <span className="rounded-lg bg-gradient-to-b from-green-100 to-green-200 px-2 text-green-800 ring-1 ring-green-300">{correctText}</span>
                  </p>
                )}
              </>
            )}
            {kind === 'timeout' && (
              <p className="flex items-center gap-2 text-2xl font-black text-sky-700 text-shadow-pop sm:text-3xl">
                <Clock className="h-8 w-8" aria-hidden="true" />
                נגמר הזמן – לא נורא, ממשיכים!
              </p>
            )}
            {explanation && (
              <p className="mt-1 flex items-start gap-2 rounded-2xl bg-white/85 px-3 py-2 text-base font-semibold text-slate-600 ring-1 ring-white shadow-[0_4px_12px_-8px_rgba(30,41,59,0.4)] sm:text-lg" data-testid="explanation">
                <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" aria-hidden="true" />
                <span>{explanation}</span>
              </p>
            )}
            <Button
              variant={kind === 'correct' ? 'success' : 'primary'}
              size="xl"
              glow
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

/** "כל הכבוד!" – גרדיאנט שמש קופץ ומתנדנד */
function Praise({ text }: { text: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.p
      initial={reduced ? false : { scale: 0.5, y: 20, opacity: 0 }}
      animate={reduced ? { opacity: 1 } : { scale: [0.5, 1.15, 1], y: [20, -6, 0], opacity: 1, rotate: [0, -2, 0] }}
      transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex items-center gap-2 text-fluid-title font-black"
    >
      <PartyPopper className="h-9 w-9 text-brand-orange drop-shadow" aria-hidden="true" />
      <span className="text-gradient-sun pb-1" style={{ filter: 'drop-shadow(0 3px 0 #fff) drop-shadow(0 8px 14px rgb(234 88 12 / 0.35))' }}>
        {text}
      </span>
    </motion.p>
  );
}

/** פרץ קונפטי "פיזיקלי" ממרכז הלוח – פעם אחת בהצגה */
function CelebrationBurst() {
  const [node, fire] = useConfettiBursts({ particleCount: 60, startVelocity: 24, spread: 100, size: 0.9 });
  useEffect(() => {
    const t1 = window.setTimeout(() => fire(50, 35), 60);
    const t2 = window.setTimeout(() => fire(22, 50), 260);
    const t3 = window.setTimeout(() => fire(78, 50), 420);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [fire]);
  return node;
}
