/**
 * PictureQuestion – מצב "תמונה מול תמונה" (רמה קלה ללא קריאה).
 * השאלה היא איור גדול, התשובות הן 4 איורים ריבועיים (2×2) ללא כיתוב.
 * המילים קיימות רק ב־alt / aria-label ולהקראה קולית (speechSynthesis).
 * Tiles adapted from 21st.dev — Pop Button by tom_ui (thick bottom deck that collapses on press).
 */
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeftRight, Check, Image as ImageIcon, Volume2, X } from 'lucide-react';
import { useEffect, useRef, type MouseEvent } from 'react';
import type { AnswerResult, QuestionOptionView, QuestionView } from '@oc/shared';
import { Shake } from '@/animations';
import { useSpeech } from '@/hooks/useSpeech';
import { LazyImage } from './_ui';
import { cn, optionState, type OptionState } from './utils';

export interface PictureQuestionProps {
  question: QuestionView;
  result: AnswerResult | null;
  selectedId: string | null;
  disabled: boolean;
  /** הזמן נגמר – האפשרויות מוצגות מעומעמות */
  expired?: boolean;
  showCorrectAnswers: boolean;
  onSelect: (option: QuestionOptionView) => void;
  /** הקראה אוטומטית של המילה כשהשאלה עולה (אם הצלילים פעילים) */
  autoSpeak?: boolean;
}

/** השהיה קצרה לפני ההקראה האוטומטית – נותנת לאנימציית הכניסה להסתיים */
export const AUTO_SPEAK_DELAY_MS = 450;

/** ארבעה צבעי סוכריה – אחד לכל אריח (פאה בהירה + סיפון רווי) */
const TILE_STYLES = [
  { idle: 'from-sky-100 via-sky-200 to-sky-300 border-sky-600 hover:from-sky-50 hover:to-sky-200', key: 'from-sky-400 to-sky-600 text-white', glow: 'shadow-[0_18px_34px_-14px_rgba(2,132,199,0.6)]' },
  { idle: 'from-violet-100 via-violet-200 to-violet-300 border-violet-700 hover:from-violet-50 hover:to-violet-200', key: 'from-violet-400 to-violet-700 text-white', glow: 'shadow-[0_18px_34px_-14px_rgba(109,40,217,0.6)]' },
  { idle: 'from-yellow-100 via-yellow-200 to-amber-300 border-amber-600 hover:from-yellow-50 hover:to-amber-200', key: 'from-yellow-300 to-amber-500 text-amber-950', glow: 'shadow-[0_18px_34px_-14px_rgba(202,138,4,0.6)]' },
  { idle: 'from-pink-100 via-pink-200 to-pink-300 border-pink-600 hover:from-pink-50 hover:to-pink-200', key: 'from-pink-400 to-pink-600 text-white', glow: 'shadow-[0_18px_34px_-14px_rgba(219,39,119,0.6)]' },
] as const;

const STATE_CLASSES: Record<Exclude<OptionState, 'idle'>, string> = {
  pending: 'from-white to-slate-100 border-slate-500 ring-4 ring-violet-300 shadow-[0_18px_34px_-14px_rgba(109,40,217,0.5)]',
  correct: 'from-green-300 via-green-400 to-green-600 border-green-900 shadow-[0_0_0_6px_rgba(34,197,94,0.3),0_18px_36px_-12px_rgba(21,128,61,0.7)]',
  wrong: 'from-rose-300 via-rose-400 to-rose-600 border-rose-800 shadow-[0_14px_28px_-12px_rgba(190,18,60,0.6)]',
  reveal: 'from-green-100 to-green-200 border-green-600 ring-4 ring-green-400 shadow-[0_14px_28px_-12px_rgba(21,128,61,0.45)]',
  dim: 'from-slate-100 to-slate-200 border-slate-300 opacity-70 shadow-none',
};

function srStateText(state: OptionState): string {
  switch (state) {
    case 'correct':
      return ' – תְּשׁוּבָה נְכוֹנָה';
    case 'wrong':
      return ' – תְּשׁוּבָה שְׁגוּיָה';
    case 'reveal':
      return ' – זוֹ הַתְּשׁוּבָה הַנְּכוֹנָה';
    case 'pending':
      return ' – נִבְחַר';
    default:
      return '';
  }
}

/** אייקון ✓/✗ גדול בפינת האריח */
function StateIcon({ state }: { state: OptionState }) {
  if (state === 'correct' || state === 'reveal') {
    return (
      <motion.span
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 16 }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white to-green-50 text-green-600 shadow-[0_6px_14px_-3px_rgba(21,128,61,0.55),inset_0_1px_0_#fff] ring-2 ring-green-300 sm:h-12 sm:w-12"
        aria-hidden="true"
      >
        <Check className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={4} />
      </motion.span>
    );
  }
  if (state === 'wrong') {
    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 16 }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-b from-white to-rose-50 text-rose-500 shadow-[0_6px_14px_-3px_rgba(190,18,60,0.55),inset_0_1px_0_#fff] ring-2 ring-rose-300 sm:h-12 sm:w-12"
        aria-hidden="true"
      >
        <X className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={4} />
      </motion.span>
    );
  }
  return null;
}

interface SpeakerButtonProps {
  label: string;
  onSpeak: () => void;
  speaking?: boolean;
  size?: 'sm' | 'lg';
  className?: string;
  testId?: string;
}

/** כפתור רמקול עגול – "חימר" סגול עם סיפון, פועם בזמן הקראה */
function SpeakerButton({ label, onSpeak, speaking = false, size = 'sm', className, testId }: SpeakerButtonProps) {
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    // הקשה על הרמקול לעולם לא בוחרת את האפשרות שמתחתיו
    e.preventDefault();
    e.stopPropagation();
    onSpeak();
  };
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={label}
      title={label}
      data-testid={testId}
      data-speaking={speaking ? 'true' : 'false'}
      className={cn(
        // המיקום (relative / absolute) נקבע על ידי הקורא דרך className
        'group isolate inline-flex shrink-0 items-center justify-center rounded-full border-b-4 border-violet-800 bg-gradient-to-b from-violet-400 via-violet-500 to-violet-600 text-white',
        'shadow-[0_10px_20px_-8px_rgba(109,40,217,0.7),inset_0_2px_0_rgba(255,255,255,0.5)] ring-2 ring-white/90',
        'transition-[transform,border-width,box-shadow] duration-100 hover:from-violet-300 hover:to-violet-500 active:translate-y-[3px] active:border-b-2',
        'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
        size === 'lg' ? 'h-14 w-14 sm:h-16 sm:w-16' : 'h-11 w-11 min-h-11 sm:h-12 sm:w-12',
        className,
      )}
    >
      {speaking && <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-violet-400/60 animate-pulse-ring" />}
      <Volume2 className={cn(size === 'lg' ? 'h-7 w-7 sm:h-8 sm:w-8' : 'h-6 w-6', speaking && 'animate-wiggle')} strokeWidth={2.75} aria-hidden="true" />
    </button>
  );
}

export function PictureQuestion({ question, result, selectedId, disabled, expired = false, showCorrectAnswers, onSelect, autoSpeak = false }: PictureQuestionProps) {
  const reduced = useReducedMotion();
  const { supported: speechSupported, speak, speaking } = useSpeech();
  const options = question.options.slice(0, 4);
  const word = question.prompt;

  // הקראה אוטומטית פעם אחת כשהשאלה עולה
  const spokeRef = useRef(false);
  useEffect(() => {
    if (!autoSpeak || !speechSupported || spokeRef.current || !word) return undefined;
    spokeRef.current = true;
    const t = window.setTimeout(() => speak(word), AUTO_SPEAK_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [autoSpeak, speechSupported, speak, word]);

  // מקלדת: ספרות 1–4 בוחרות אפשרות
  useEffect(() => {
    if (disabled) return undefined;
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
    <div className="flex flex-col items-center gap-4 sm:gap-5 lg:grid lg:grid-cols-2 lg:items-center lg:gap-8">
      {/* ===== כַּרְטִיס הַשְּׁאֵלָה: אִיּוּר גָּדוֹל בְּמִסְגֶּרֶת מַבְרִיקָה ===== */}
      <motion.section
        aria-label={`הַשְּׁאֵלָה: ${word}`}
        data-testid="prompt-card"
        initial={{ y: -16, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className={cn(
          'relative w-full overflow-hidden rounded-[2rem] bg-gradient-to-b from-white to-slate-50 p-3 text-center ring-1 ring-white sm:p-4',
          'shadow-[0_2px_4px_rgba(30,41,59,0.06),0_26px_60px_-20px_rgba(30,41,59,0.35),inset_0_2px_0_#fff,inset_0_-6px_0_rgba(30,41,59,0.05)]',
          'lg:sticky lg:top-4',
        )}
      >
        {/* עִיטּוּר פִּינּוֹת */}
        <span aria-hidden="true" className="pointer-events-none absolute -start-10 -top-10 size-32 rounded-full bg-gradient-to-br from-sky-200/70 to-transparent blur-2xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 -end-10 size-36 rounded-full bg-gradient-to-tl from-violet-200/70 to-transparent blur-2xl" />

        {/* שׁוּרַת הוֹרָאָה לְלֹא קְרִיאָה: [תְּמוּנָה] ↔ [?] + רַמְקוֹל */}
        <div className="relative mb-3 flex items-center justify-center gap-3">
          <p
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-violet-50 to-violet-100 px-4 py-1.5 text-base font-black text-violet-800 ring-1 ring-violet-200 shadow-[inset_0_1px_0_#fff] sm:text-lg"
            aria-label="מָצְאוּ אֶת הַתְּמוּנָה הַהֲפוּכָה"
          >
            <span aria-hidden="true" className="flex items-center gap-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-sky-300 to-sky-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <ImageIcon className="h-4.5 w-4.5" strokeWidth={2.75} />
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b from-violet-400 to-violet-700 text-white shadow-[0_4px_8px_-3px_rgba(109,40,217,0.7),inset_0_1px_0_rgba(255,255,255,0.5)]">
                <ArrowLeftRight className="h-5 w-5" strokeWidth={3.5} />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-lg font-black leading-none text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">?</span>
            </span>
            <span className="text-sm font-bold text-violet-700 sm:text-base">הַהֶפֶךְ</span>
          </p>
          {speechSupported && (
            <SpeakerButton label="הַשֵּׁמַע אֶת הַמִּילָּה" onSpeak={() => speak(word)} speaking={speaking} size="lg" testId="speak-prompt" className="relative" />
          )}
        </div>

        {/* מִסְגֶּרֶת הָאִיּוּר – ≥40% מִגּוֹבַהּ הַמָּסָךְ בַּטֵּלֵפוֹן */}
        <div
          data-testid="prompt-image"
          className={cn(
            'relative mx-auto aspect-square w-full max-w-[min(100%,46dvh)] overflow-hidden rounded-[1.75rem] sm:max-w-[min(100%,46dvh,360px)] md:max-w-[min(100%,400px)]',
            'bg-gradient-to-b from-white to-slate-100 p-2 ring-1 ring-white',
            'shadow-[inset_0_2px_0_#fff,inset_0_-4px_8px_rgba(30,41,59,0.08),0_14px_30px_-14px_rgba(30,41,59,0.45)]',
          )}
        >
          {question.promptImage && (
            <LazyImage src={question.promptImage} alt={word} className="h-full w-full rounded-[1.4rem]" imgClassName="p-1" />
          )}
          {/* גְּלוֹס עֶלְיוֹן */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-0 h-[36%] rounded-full bg-gradient-to-b from-white/70 to-transparent" />
        </div>
      </motion.section>

      {/* ===== 4 אֲרִיחֵי תְּמוּנָה 2×2 ===== */}
      <div
        role="group"
        aria-label="אֶפְשָׁרוּיוֹת תְּשׁוּבָה – בַּחֲרוּ אֶת הַתְּמוּנָה הַהֲפוּכָה"
        data-testid="options"
        className="grid w-full max-w-[464px] grid-cols-2 gap-3 sm:gap-4"
      >
        {options.map((opt, i) => {
          const style = TILE_STYLES[i % TILE_STYLES.length] ?? TILE_STYLES[0];
          const state = optionState(opt, selectedId, result, showCorrectAnswers, expired);
          const isWrong = state === 'wrong';
          const isCorrect = state === 'correct';
          const interactive = !disabled && !reduced;
          const classes = state === 'idle' ? cn(style.idle, style.glow) : STATE_CLASSES[state];
          const showCaption = !!result && showCorrectAnswers && (state === 'correct' || state === 'reveal' || state === 'wrong');
          return (
            <Shake key={opt.id} active={isWrong} className="relative">
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0, scale: isCorrect && !reduced ? [1, 1.06, 1] : 1 }}
                transition={{ delay: result ? 0 : 0.08 * i, type: 'spring', stiffness: 300, damping: 22, scale: { type: 'tween', duration: 0.45, ease: 'easeInOut' } }}
                whileHover={interactive ? { y: -4 } : undefined}
                onClick={() => !disabled && onSelect(opt)}
                disabled={disabled && !result}
                aria-disabled={disabled}
                aria-label={`${opt.text}${srStateText(state)}`}
                tabIndex={disabled && !result ? -1 : 0}
                aria-pressed={selectedId === opt.id}
                data-testid={`option-${i + 1}`}
                data-state={state}
                className={cn(
                  'group relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border-b-[8px] bg-gradient-to-b p-2.5 sm:p-3',
                  'transition-[background-color,border-color,box-shadow,transform] duration-150',
                  !disabled && 'active:translate-y-[4px] active:border-b-[4px]',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-500 focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed',
                  classes,
                )}
              >
                {/* גְּלוֹס עֶלְיוֹן */}
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-0 h-[40%] rounded-full bg-gradient-to-b from-white/60 to-transparent" />

                {/* מִסְגֶּרֶת פְּנִימִית לְבָנָה לְאִיּוּר */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1.25rem] bg-gradient-to-b from-white to-slate-50 ring-1 ring-white/80',
                    'shadow-[inset_0_2px_0_#fff,inset_0_-3px_6px_rgba(30,41,59,0.08),0_6px_14px_-8px_rgba(30,41,59,0.4)]',
                    state === 'dim' && 'saturate-50',
                  )}
                >
                  {opt.image && <LazyImage src={opt.image} alt="" className="h-full w-full" imgClassName="p-1" />}
                </span>

                {/* כִּיתּוּב זָעִיר – רַק בַּחֲשִׂיפַת הַתְּשׁוּבָה */}
                {showCaption && (
                  <span
                    data-testid="option-caption"
                    className={cn(
                      'pointer-events-none absolute bottom-3 start-3 end-3 rounded-full px-2 py-0.5 text-center text-sm font-black ring-1 sm:text-base',
                      speechSupported && 'end-[3.6rem] sm:end-16',
                      isWrong ? 'bg-white/90 text-rose-700 ring-rose-200' : 'bg-white/90 text-green-800 ring-green-200',
                    )}
                  >
                    {opt.text}
                  </span>
                )}

                {/* מִסְפַּר מַקָּשׁ */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute start-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-b text-base font-black ring-2 ring-white/90',
                    'shadow-[0_4px_8px_-2px_rgba(30,41,59,0.4),inset_0_1px_0_rgba(255,255,255,0.5)]',
                    state === 'idle' || state === 'pending' ? style.key : 'from-white to-slate-100 text-slate-700',
                  )}
                >
                  {i + 1}
                </span>
                <span className="absolute end-2.5 top-2.5">
                  <StateIcon state={state} />
                </span>
              </motion.button>

              {/* רַמְקוֹל שֶׁל הָאֶפְשָׁרוּת – אָח שֶׁל הַכַּפְתּוֹר (לֹא בְּתוֹכוֹ) כְּדֵי לֹא לִבְחוֹר אֶת הָאָרִיחַ */}
              {speechSupported && opt.text && (
                <SpeakerButton
                  label={`הַשֵּׁמַע: ${opt.text}`}
                  onSpeak={() => speak(opt.text)}
                  size="sm"
                  testId={`speak-option-${i + 1}`}
                  className="absolute bottom-[1.15rem] end-2.5 z-10 sm:bottom-6 sm:end-3"
                />
              )}
            </Shake>
          );
        })}
      </div>
    </div>
  );
}

export default PictureQuestion;
