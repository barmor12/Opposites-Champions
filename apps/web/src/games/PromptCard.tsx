import { motion } from 'motion/react';
import { useMemo, type ReactNode } from 'react';
import { QuestionType, type QuestionView } from '@oc/shared';
import { LazyImage } from './_ui';
import { cn, promptInstruction } from './utils';

export interface PromptCardProps {
  question: QuestionView;
  /** טקסט שימלא את החלל במשפט (לאחר בחירה) */
  filled?: { text: string; state: 'pending' | 'correct' | 'wrong' } | null;
  children?: ReactNode;
}

const BLANK_RE = /_{3,}/;

/** כרטיס ה"שאלה": מילה גדולה / משפט עם חלל, ותמונה אופציונלית */
export function PromptCard({ question, filled = null, children }: PromptCardProps) {
  const isSentence = question.type === QuestionType.COMPLETE_SENTENCE || BLANK_RE.test(question.prompt);
  const isMatch = question.type === QuestionType.MATCH_PAIRS;

  const sentenceParts = useMemo(() => {
    if (!isSentence) return null;
    const idx = question.prompt.search(BLANK_RE);
    if (idx < 0) return [question.prompt, ''];
    const match = question.prompt.match(BLANK_RE);
    const len = match?.[0]?.length ?? 4;
    return [question.prompt.slice(0, idx), question.prompt.slice(idx + len)];
  }, [isSentence, question.prompt]);

  return (
    <motion.section
      aria-label="השאלה"
      data-testid="prompt-card"
      initial={{ y: -16, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={cn(
        'relative overflow-hidden rounded-3xl bg-white text-center shadow-lg ring-4 ring-white/70',
        isMatch ? 'px-4 py-3 sm:px-6 sm:py-4' : 'px-4 py-5 sm:px-8 sm:py-7',
      )}
    >
      {isMatch ? (
        <h1 data-testid="prompt-word" className="flex items-center justify-center gap-2 text-2xl font-black text-violet-700 sm:text-3xl">
          <span aria-hidden="true">🔗</span>
          {question.prompt || promptInstruction(question.type)}
        </h1>
      ) : (
        <p className="mb-2 text-base font-bold text-slate-500 sm:text-lg">{promptInstruction(question.type)}</p>
      )}

      <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
        {question.promptImage && (
          <LazyImage
            src={question.promptImage}
            alt={question.prompt}
            className="h-32 w-32 shrink-0 rounded-2xl bg-sky-50 sm:h-40 sm:w-40"
            imgClassName="p-2"
          />
        )}

        {isMatch ? null : isSentence && sentenceParts ? (
          <p className="text-3xl font-black leading-relaxed text-slate-800 sm:text-4xl md:text-5xl" dir="rtl">
            {sentenceParts[0]}
            <span
              data-testid="sentence-blank"
              className={cn(
                'mx-1 inline-flex min-w-[4.5ch] items-center justify-center rounded-xl border-4 border-dashed px-3 py-0.5 align-middle transition-colors',
                !filled && 'border-sky-400 bg-sky-50 text-sky-400',
                filled?.state === 'pending' && 'border-violet-400 bg-violet-50 text-violet-700',
                filled?.state === 'correct' && 'border-green-500 bg-green-100 text-green-700',
                filled?.state === 'wrong' && 'border-red-400 bg-red-50 text-red-600 line-through',
              )}
            >
              {filled ? filled.text : '____'}
            </span>
            {sentenceParts[1]}
          </p>
        ) : (
          <h1
            data-testid="prompt-word"
            className="bg-gradient-to-b from-violet-600 to-sky-500 bg-clip-text text-5xl font-black leading-tight text-transparent sm:text-6xl md:text-7xl"
          >
            {question.prompt}
          </h1>
        )}
      </div>
      {children}
    </motion.section>
  );
}
