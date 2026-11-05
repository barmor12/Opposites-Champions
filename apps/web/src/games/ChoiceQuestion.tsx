// Option tiles adapted from 21st.dev — Pop Button by tom_ui: thick bottom border (deck) that collapses on press.
import { motion, useReducedMotion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { useEffect } from 'react';
import { QuestionType, type AnswerResult, type QuestionOptionView, type QuestionView } from '@oc/shared';
import { Shake } from '@/animations';
import { LazyImage } from './_ui';
import { cn, optionState, type OptionState } from './utils';

export interface ChoiceQuestionProps {
  question: QuestionView;
  result: AnswerResult | null;
  selectedId: string | null;
  disabled: boolean;
  /** הזמן נגמר – האפשרויות מוצגות מעומעמות */
  expired?: boolean;
  showCorrectAnswers: boolean;
  onSelect: (option: QuestionOptionView) => void;
}

/** ארבעה צבעי סוכריה – אחד לכל אפשרות (פאה בהירה + סיפון רווי, טקסט כהה ל־AA) */
const OPTION_STYLES = [
  { idle: 'from-sky-100 via-sky-200 to-sky-300 border-sky-600 text-sky-950 hover:from-sky-50 hover:to-sky-200', key: 'from-sky-400 to-sky-600 text-white', glow: 'shadow-[0_16px_30px_-12px_rgba(2,132,199,0.55)]' },
  { idle: 'from-violet-100 via-violet-200 to-violet-300 border-violet-700 text-violet-950 hover:from-violet-50 hover:to-violet-200', key: 'from-violet-400 to-violet-700 text-white', glow: 'shadow-[0_16px_30px_-12px_rgba(109,40,217,0.55)]' },
  { idle: 'from-yellow-100 via-yellow-200 to-amber-300 border-amber-600 text-amber-950 hover:from-yellow-50 hover:to-amber-200', key: 'from-yellow-300 to-amber-500 text-amber-950', glow: 'shadow-[0_16px_30px_-12px_rgba(202,138,4,0.55)]' },
  { idle: 'from-pink-100 via-pink-200 to-pink-300 border-pink-600 text-pink-950 hover:from-pink-50 hover:to-pink-200', key: 'from-pink-400 to-pink-600 text-white', glow: 'shadow-[0_16px_30px_-12px_rgba(219,39,119,0.55)]' },
] as const;

const STATE_CLASSES: Record<Exclude<OptionState, 'idle'>, string> = {
  pending: 'from-white to-slate-100 border-slate-500 text-slate-800 ring-4 ring-violet-300 shadow-[0_16px_30px_-12px_rgba(109,40,217,0.45)]',
  correct: 'from-green-400 via-green-500 to-green-700 border-green-900 text-white shadow-[0_0_0_6px_rgba(34,197,94,0.3),0_18px_36px_-12px_rgba(21,128,61,0.7)]',
  wrong: 'from-rose-400 via-rose-500 to-rose-600 border-rose-800 text-white shadow-[0_14px_28px_-12px_rgba(190,18,60,0.6)]',
  reveal: 'from-green-100 to-green-200 border-green-600 text-green-900 ring-4 ring-green-400 shadow-[0_14px_28px_-12px_rgba(21,128,61,0.45)]',
  dim: 'from-slate-100 to-slate-200 border-slate-300 text-slate-400 opacity-80 shadow-none',
};

function StateIcon({ state }: { state: OptionState }) {
  if (state === 'correct' || state === 'reveal') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-white to-green-50 text-green-600 shadow-[0_4px_10px_-2px_rgba(21,128,61,0.5),inset_0_1px_0_#fff] ring-2 ring-green-200" aria-hidden="true">
        <Check className="h-6 w-6" strokeWidth={4} />
      </span>
    );
  }
  if (state === 'wrong') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-white to-rose-50 text-rose-500 shadow-[0_4px_10px_-2px_rgba(190,18,60,0.5),inset_0_1px_0_#fff] ring-2 ring-rose-200" aria-hidden="true">
        <X className="h-6 w-6" strokeWidth={4} />
      </span>
    );
  }
  return null;
}

function srStateText(state: OptionState): string {
  switch (state) {
    case 'correct':
      return ' – תשובה נכונה';
    case 'wrong':
      return ' – תשובה שגויה';
    case 'reveal':
      return ' – זו התשובה הנכונה';
    case 'pending':
      return ' – נבחר';
    default:
      return '';
  }
}

export function ChoiceQuestion({ question, result, selectedId, disabled, expired = false, showCorrectAnswers, onSelect }: ChoiceQuestionProps) {
  const reduced = useReducedMotion();
  const isImage = question.type === QuestionType.CHOOSE_IMAGE;
  const options = question.options.slice(0, 4);

  // keyboard: digits 1-4 select
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number.parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        const opt = options[n - 1];
        if (opt) {
          e.preventDefault();
          onSelect(opt);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, onSelect, options]);

  return (
    <div
      role="group"
      aria-label="אפשרויות תשובה"
      data-testid="options"
      className={cn('grid gap-3 sm:gap-4', isImage ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2')}
    >
      {options.map((opt, i) => {
        const style = OPTION_STYLES[i % OPTION_STYLES.length] ?? OPTION_STYLES[0];
        const state = optionState(opt, selectedId, result, showCorrectAnswers, expired);
        const isWrong = state === 'wrong';
        const isCorrect = state === 'correct';
        const interactive = !disabled && !reduced;
        const classes = state === 'idle' ? cn(style.idle, style.glow) : STATE_CLASSES[state];
        return (
          <Shake key={opt.id} active={isWrong}>
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0, scale: isCorrect && !reduced ? [1, 1.06, 1] : 1 }}
              transition={{ delay: result ? 0 : 0.08 * i, type: 'spring', stiffness: 300, damping: 22, scale: { type: 'tween', duration: 0.45, ease: 'easeInOut' } }}
              whileHover={interactive ? { y: -4 } : undefined}
              onClick={() => !disabled && onSelect(opt)}
              disabled={disabled && !result}
              aria-disabled={disabled}
              tabIndex={disabled && !result ? -1 : 0}
              aria-pressed={selectedId === opt.id}
              data-testid={`option-${i + 1}`}
              data-state={state}
              className={cn(
                'group relative flex w-full items-center justify-center overflow-hidden rounded-3xl border-b-[7px] bg-gradient-to-b font-black',
                'transition-[background-color,border-color,box-shadow,transform] duration-150',
                !disabled && 'active:translate-y-[4px] active:border-b-[3px]',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed',
                isImage ? 'min-h-40 flex-col gap-2 p-3 sm:min-h-52 lg:min-h-56' : 'min-h-[4.25rem] px-14 py-4 text-fluid-option sm:min-h-[5.5rem]',
                classes,
              )}
            >
              {/* גלוס עליון */}
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-0 h-[42%] rounded-full bg-gradient-to-b from-white/60 to-transparent" />
              {/* מספר מקש */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute start-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b text-base font-black ring-2 ring-white/80',
                  'shadow-[0_4px_8px_-2px_rgba(30,41,59,0.4),inset_0_1px_0_rgba(255,255,255,0.5)]',
                  state === 'idle' || state === 'pending' ? style.key : 'from-white to-slate-100 text-slate-700',
                )}
              >
                {i + 1}
              </span>
              <span className="absolute end-3 top-3">
                <StateIcon state={state} />
              </span>

              {isImage && opt.image && (
                <LazyImage
                  src={opt.image}
                  alt={opt.text}
                  glossy
                  className="h-24 w-24 sm:h-32 sm:w-32 lg:h-36 lg:w-36"
                  imgClassName="p-2"
                />
              )}
              <span className={cn('relative text-shadow-[0_1px_0_rgba(255,255,255,0.5)]', isImage && 'text-xl sm:text-2xl', (isCorrect || isWrong) && 'drop-shadow-[0_1px_0_rgba(0,0,0,0.25)]')}>
                {opt.text}
                <span className="sr-only">{srStateText(state)}</span>
              </span>
            </motion.button>
          </Shake>
        );
      })}
    </div>
  );
}
