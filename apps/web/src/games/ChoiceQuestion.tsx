import { motion, useReducedMotion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { useEffect } from 'react';
import { QuestionType, type AnswerResult, type QuestionOptionView, type QuestionView } from '@oc/shared';
import { Shake } from '@/animations';
import { LazyImage, cn } from './_ui';

export interface ChoiceQuestionProps {
  question: QuestionView;
  result: AnswerResult | null;
  selectedId: string | null;
  disabled: boolean;
  showCorrectAnswers: boolean;
  onSelect: (option: QuestionOptionView) => void;
}

/** ארבעה צבעי פסטל – אחד לכל אפשרות */
const OPTION_STYLES = [
  { idle: 'border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200', key: 'bg-sky-400 text-white' },
  { idle: 'border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-200', key: 'bg-violet-400 text-white' },
  { idle: 'border-yellow-300 bg-yellow-100 text-yellow-900 hover:bg-yellow-200', key: 'bg-yellow-400 text-yellow-900' },
  { idle: 'border-pink-300 bg-pink-100 text-pink-900 hover:bg-pink-200', key: 'bg-pink-400 text-white' },
] as const;

export type OptionState = 'idle' | 'pending' | 'correct' | 'wrong' | 'reveal' | 'dim';

export function optionState(
  option: QuestionOptionView,
  selectedId: string | null,
  result: AnswerResult | null,
  showCorrectAnswers: boolean,
): OptionState {
  if (!result) return selectedId === option.id ? 'pending' : 'idle';
  const isChosen = selectedId === option.id;
  const isCorrectOption = result.correctOptionId ? result.correctOptionId === option.id : isChosen && result.correct;
  if (isChosen && result.correct) return 'correct';
  if (isChosen && !result.correct) return 'wrong';
  if (isCorrectOption && showCorrectAnswers) return 'reveal';
  return 'dim';
}

const STATE_CLASSES: Record<Exclude<OptionState, 'idle'>, string> = {
  pending: 'border-slate-400 bg-white text-slate-800 ring-4 ring-slate-300 scale-[1.02]',
  correct: 'border-green-600 bg-green-500 text-white shadow-[0_0_0_6px_rgba(34,197,94,0.3)]',
  wrong: 'border-red-500 bg-red-400 text-white',
  reveal: 'border-green-500 bg-green-100 text-green-800 ring-4 ring-green-300',
  dim: 'border-slate-200 bg-slate-100 text-slate-400 opacity-70',
};

function StateIcon({ state }: { state: OptionState }) {
  if (state === 'correct' || state === 'reveal') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-green-600 shadow" aria-hidden="true">
        <Check className="h-6 w-6" strokeWidth={4} />
      </span>
    );
  }
  if (state === 'wrong') {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-500 shadow" aria-hidden="true">
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

export function ChoiceQuestion({ question, result, selectedId, disabled, showCorrectAnswers, onSelect }: ChoiceQuestionProps) {
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
        const state = optionState(opt, selectedId, result, showCorrectAnswers);
        const isWrong = state === 'wrong';
        const isCorrect = state === 'correct';
        const classes = state === 'idle' ? style.idle : STATE_CLASSES[state];
        return (
          <Shake key={opt.id} active={isWrong}>
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0, scale: isCorrect && !reduced ? [1, 1.06, 1] : 1 }}
              transition={{ delay: result ? 0 : 0.08 * i, type: 'spring', stiffness: 300, damping: 22 }}
              whileHover={!disabled && !reduced ? { scale: 1.03 } : undefined}
              whileTap={!disabled && !reduced ? { scale: 0.96 } : undefined}
              onClick={() => !disabled && onSelect(opt)}
              disabled={disabled && !result}
              aria-disabled={disabled}
              aria-pressed={selectedId === opt.id}
              data-testid={`option-${i + 1}`}
              data-state={state}
              className={cn(
                'relative flex w-full items-center justify-center rounded-3xl border-4 font-black transition-colors',
                'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed',
                isImage ? 'min-h-40 flex-col gap-2 p-3 sm:min-h-52' : 'min-h-16 px-14 py-4 text-2xl sm:min-h-20 sm:text-3xl',
                classes,
              )}
            >
              {/* מספר מקש */}
              <span
                aria-hidden="true"
                className={cn(
                  'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-base font-black shadow',
                  state === 'idle' || state === 'pending' ? style.key : 'bg-white/80 text-slate-700',
                )}
              >
                {i + 1}
              </span>
              <span className="absolute left-3 top-3">
                <StateIcon state={state} />
              </span>

              {isImage && opt.image && (
                <LazyImage
                  src={opt.image}
                  alt={opt.text}
                  className="h-24 w-24 rounded-2xl bg-white/70 sm:h-32 sm:w-32"
                  imgClassName="p-1"
                />
              )}
              <span className={cn(isImage && 'text-xl sm:text-2xl')}>
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
