import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  QuestionType,
  TREASURE_BONUS,
  type AnswerPayload,
  type AnswerResult,
  type MatchAnswerPayload,
  type QuestionOptionView,
  type QuestionView,
} from '@oc/shared';
import { Confetti, FloatingStars, StarBurst } from '@/animations';
import { ChoiceQuestion } from './ChoiceQuestion';
import { FeedbackPanel, type FeedbackKind } from './FeedbackPanel';
import { MatchPairsQuestion } from './MatchPairsQuestion';
import { PromptCard } from './PromptCard';
import { TreasureOverlay } from './TreasureOverlay';
import { TreasurePath } from './TreasurePath';
import { useGameSound } from './useGameSound';

export interface QuestionRendererProps {
  question: QuestionView;
  result: AnswerResult | null;
  onAnswer: (payload: AnswerPayload) => Promise<AnswerResult>;
  onNext: () => void;
  soundsEnabled: boolean;
  showCorrectAnswers: boolean;
  /** serverNow ≈ Date.now() + serverOffsetMs */
  serverOffsetMs: number;
}

/** זמן המתנה לפני מעבר אוטומטי לשאלה הבאה (אם התלמיד לא לחץ "המשך") */
export const AUTO_NEXT_MS = 6000;
export const AUTO_NEXT_TREASURE_MS = 9000;

/**
 * QuestionRenderer – מציג שאלה אחת (מכל סוג) ומנהל: בחירה, שליחה, משוב, צלילים, המשך.
 * המעטפת (shell) אחראית על הטיימר, הסוקט והניווט.
 */
export function QuestionRenderer(props: QuestionRendererProps) {
  // key על מזהה השאלה מאפס את כל המצב הפנימי במעבר שאלה
  return <QuestionBody key={props.question.sessionQuestionId} {...props} />;
}

function QuestionBody({ question, result: resultProp, onAnswer, onNext, soundsEnabled, showCorrectAnswers, serverOffsetMs }: QuestionRendererProps) {
  const play = useGameSound(soundsEnabled);

  const [localResult, setLocalResult] = useState<AnswerResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [treasureOpen, setTreasureOpen] = useState(false);
  const nextCalled = useRef(false);

  // התוצאה: מה־prop (מקור האמת) או מהערך שחזר מ־onAnswer
  const candidate = resultProp ?? localResult;
  const result = candidate && candidate.sessionQuestionId === question.sessionQuestionId ? candidate : null;
  // הרכיב ממופתח לפי השאלה, לכן "תוצאה נכונה" היא אירוע חד-פעמי → קונפטי ופרץ כוכבים נגזרים ישירות
  const celebrate = !!result?.correct;

  // ----- פג תוקף לפי endsAt + serverOffsetMs -----
  useEffect(() => {
    if (!question.endsAt || result) return;
    const check = () => {
      const serverNow = Date.now() + serverOffsetMs;
      if (question.endsAt !== null && serverNow >= question.endsAt) {
        setExpired(true);
        return true;
      }
      return false;
    };
    if (check()) return;
    const id = window.setInterval(() => {
      if (check()) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [question.endsAt, serverOffsetMs, result]);

  const goNext = useCallback(() => {
    if (nextCalled.current) return;
    nextCalled.current = true;
    onNext();
  }, [onNext]);

  // ----- תגובה להגעת תוצאה: צלילים, אנימציות -----
  const announcedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!result || announcedFor.current === result.sessionQuestionId) return;
    announcedFor.current = result.sessionQuestionId;
    if (result.correct) {
      play('correct');
    } else {
      play('wrong');
    }
    if (result.treasureCompleted) {
      const t1 = window.setTimeout(() => {
        setTreasureOpen(true);
        play('treasure');
      }, 900);
      const t2 = window.setTimeout(() => play('fanfare'), 1700);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    return undefined;
  }, [result, play]);

  // ----- המשך אוטומטי -----
  const showingFeedback = !!result || expired;
  useEffect(() => {
    if (!showingFeedback) return;
    const ms = result?.treasureCompleted ? AUTO_NEXT_TREASURE_MS : AUTO_NEXT_MS;
    const t = window.setTimeout(goNext, ms);
    return () => window.clearTimeout(t);
  }, [showingFeedback, result?.treasureCompleted, goNext]);

  // ----- Enter → המשך -----
  useEffect(() => {
    if (!showingFeedback || treasureOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showingFeedback, treasureOpen, goNext]);

  // ----- שליחה -----
  const submit = useCallback(
    async (payload: AnswerPayload) => {
      if (submitting || result || expired) return;
      setSubmitting(true);
      setSubmitError(null);
      try {
        const r = await onAnswer(payload);
        if (r) setLocalResult(r);
      } catch {
        setSubmitError('אופס, משהו השתבש. נסו שוב!');
        setSelectedId(null);
      } finally {
        setSubmitting(false);
      }
    },
    [onAnswer, submitting, result, expired],
  );

  const handleSelect = useCallback(
    (option: QuestionOptionView) => {
      if (submitting || result || expired) return;
      play('click');
      setSelectedId(option.id);
      void submit({ sessionQuestionId: question.sessionQuestionId, optionId: option.id });
    },
    [submitting, result, expired, play, submit, question.sessionQuestionId],
  );

  const handleMatchSubmit = useCallback(
    (p: Omit<MatchAnswerPayload, 'sessionQuestionId'>) => {
      play('click');
      void submit({ sessionQuestionId: question.sessionQuestionId, ...p });
    },
    [play, submit, question.sessionQuestionId],
  );

  // ----- נגזרות לתצוגה -----
  const isMatch = question.type === QuestionType.MATCH_PAIRS;
  const inputDisabled = submitting || !!result || expired;
  const feedbackKind: FeedbackKind | null = result ? (result.correct ? 'correct' : 'wrong') : expired ? 'timeout' : null;

  const selectedOption = question.options.find((o) => o.id === selectedId) ?? null;
  const correctOption = result?.correctOptionId ? (question.options.find((o) => o.id === result.correctOptionId) ?? null) : null;
  const correctText = !isMatch && result && !result.correct && showCorrectAnswers ? correctOption?.text ?? null : null;
  const explanation = result ? (result.explanation ?? (!result.correct ? question.explanationHint : undefined) ?? null) : null;

  const sentenceFill =
    question.type === QuestionType.COMPLETE_SENTENCE
      ? result && !result.correct && showCorrectAnswers && correctOption
        ? { text: correctOption.text, state: 'correct' as const }
        : selectedOption
          ? { text: selectedOption.text, state: result ? (result.correct ? ('correct' as const) : ('wrong' as const)) : ('pending' as const) }
          : null
      : null;

  return (
    <div dir="rtl" lang="he" data-testid="question-renderer" data-type={question.type} className="relative mx-auto w-full max-w-3xl px-4 py-3 sm:py-5">
      <FloatingStars count={10} className="-z-10 opacity-70" />
      <StarBurst trigger={celebrate ? 1 : 0} />
      <Confetti active={celebrate} durationMs={2200} />

      <div className="flex flex-col gap-4 sm:gap-5">
        {question.isTreasure && (
          <TreasurePath step={question.treasureStep ?? 1} total={question.treasureTotal ?? 5} completed={!!result?.treasureCompleted} />
        )}

        <PromptCard question={question} filled={sentenceFill} />

        {isMatch ? (
          <MatchPairsQuestion
            question={question}
            result={result}
            disabled={inputDisabled}
            showCorrectAnswers={showCorrectAnswers}
            onSubmit={handleMatchSubmit}
            onLink={() => play('flip')}
            onUnlink={() => play('wrong')}
          />
        ) : (
          <ChoiceQuestion
            question={question}
            result={result}
            selectedId={selectedId}
            disabled={inputDisabled}
            showCorrectAnswers={showCorrectAnswers}
            onSelect={handleSelect}
          />
        )}

        <AnimatePresence>
          {submitting && !result && (
            <motion.p
              key="sending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              role="status"
              className="text-center text-lg font-bold text-slate-500"
            >
              בודקים את התשובה…
            </motion.p>
          )}
        </AnimatePresence>
        {submitError && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2 text-center text-lg font-bold text-red-600 ring-2 ring-red-200">
            {submitError}
          </p>
        )}

        <FeedbackPanel kind={feedbackKind} result={result} correctText={correctText} explanation={explanation} onNext={goNext} />
      </div>

      <AnimatePresence>
        {treasureOpen && <TreasureOverlay bonus={result?.treasureBonus ?? TREASURE_BONUS} onContinue={goNext} />}
      </AnimatePresence>
    </div>
  );
}

export default QuestionRenderer;
