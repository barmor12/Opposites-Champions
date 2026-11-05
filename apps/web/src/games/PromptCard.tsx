// Spotlight adapted from 21st.dev — Spotlight Card by preetsuthar17 (radial glow following the pointer).
import { motion } from 'motion/react';
import { useMemo, useRef, type PointerEvent, type ReactNode } from 'react';
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

/** כרטיס ה"שאלה": מילה גדולה / משפט עם חלל, ותמונה אופציונלית – חימר לבן עם עומק וזרקור */
export function PromptCard({ question, filled = null, children }: PromptCardProps) {
  const isSentence = question.type === QuestionType.COMPLETE_SENTENCE || BLANK_RE.test(question.prompt);
  const isMatch = question.type === QuestionType.MATCH_PAIRS;
  const ref = useRef<HTMLElement>(null);
  const frame = useRef<number | null>(null);

  const sentenceParts = useMemo(() => {
    if (!isSentence) return null;
    const idx = question.prompt.search(BLANK_RE);
    if (idx < 0) return [question.prompt, ''];
    const match = question.prompt.match(BLANK_RE);
    const len = match?.[0]?.length ?? 4;
    return [question.prompt.slice(0, idx), question.prompt.slice(idx + len)];
  }, [isSentence, question.prompt]);

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || frame.current !== null) return;
    const el = ref.current;
    if (!el) return;
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--spot-x', `${clientX - r.left}px`);
      el.style.setProperty('--spot-y', `${clientY - r.top}px`);
      el.style.setProperty('--spot-o', '1');
    });
  };

  return (
    <motion.section
      ref={ref}
      aria-label="השאלה"
      data-testid="prompt-card"
      initial={{ y: -16, opacity: 0, scale: 0.98 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      onPointerMove={onMove}
      onPointerLeave={() => ref.current?.style.setProperty('--spot-o', '0')}
      className={cn(
        'relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-white to-slate-50 text-center ring-1 ring-white',
        'shadow-[0_2px_4px_rgba(30,41,59,0.06),0_26px_60px_-20px_rgba(30,41,59,0.35),inset_0_2px_0_#fff,inset_0_-6px_0_rgba(30,41,59,0.05)]',
        isMatch ? 'px-4 py-3 sm:px-6 sm:py-4' : 'px-4 py-5 sm:px-8 sm:py-7',
      )}
    >
      {/* זרקור */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{ opacity: 'var(--spot-o, 0)' as unknown as number, background: 'radial-gradient(360px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgb(139 92 246 / 0.14), transparent 70%)' }}
      />
      {/* עיטור פינות */}
      <span aria-hidden="true" className="pointer-events-none absolute -start-10 -top-10 size-32 rounded-full bg-gradient-to-br from-sky-200/70 to-transparent blur-2xl" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 -end-10 size-36 rounded-full bg-gradient-to-tl from-violet-200/70 to-transparent blur-2xl" />

      {isMatch ? (
        <h1 data-testid="prompt-word" className="relative flex items-center justify-center gap-2 text-fluid-title font-black text-violet-700">
          <span aria-hidden="true">🔗</span>
          {question.prompt || promptInstruction(question.type)}
        </h1>
      ) : (
        <p className="relative mx-auto mb-3 inline-block rounded-full bg-gradient-to-b from-violet-50 to-violet-100 px-4 py-1 text-sm font-bold text-violet-800 ring-1 ring-violet-200 shadow-[inset_0_1px_0_#fff] sm:text-base">
          {promptInstruction(question.type)}
        </p>
      )}

      <div className="relative flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8">
        {question.promptImage && (
          <LazyImage
            src={question.promptImage}
            alt={question.prompt}
            glossy
            className="h-32 w-32 shrink-0 sm:h-40 sm:w-40 lg:h-44 lg:w-44"
            imgClassName="p-2"
          />
        )}

        {isMatch ? null : isSentence && sentenceParts ? (
          <p className="text-fluid-sentence font-black leading-relaxed text-slate-800 text-shadow-deep" dir="rtl">
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
            className="text-gradient-brand text-fluid-word font-black leading-[1.15] pb-1"
            style={{ filter: 'drop-shadow(0 4px 0 rgb(255 255 255)) drop-shadow(0 12px 18px rgb(109 40 217 / 0.3))' }}
          >
            {question.prompt}
          </h1>
        )}
      </div>
      {children}
    </motion.section>
  );
}
