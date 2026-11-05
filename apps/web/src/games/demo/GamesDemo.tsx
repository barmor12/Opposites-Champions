/**
 * GamesDemo – עמוד פיתוח עצמאי שמציג את QuestionRenderer עם שאלות לדוגמה מכל הסוגים
 * ו־onAnswer מזויף שמחזיר AnswerResult סביר. המעטפת מרכיבה אותו ב־/dev/games.
 */
import { useCallback, useMemo, useState } from 'react';
import { Volume2, VolumeX, RotateCcw } from 'lucide-react';
import {
  QUESTION_TYPE_LABELS,
  QuestionType,
  TREASURE_BONUS,
  calculateMatchScore,
  calculateScore,
  type AnswerPayload,
  type AnswerResult,
  type QuestionView,
} from '@oc/shared';
import { useSound } from '@/hooks/useSound';
import { PageBackground } from '@/components/ui';
import { QuestionRenderer } from '../QuestionRenderer';
import { cn } from '../utils';

interface DemoQuestion {
  label: string;
  view: QuestionView;
  correctOptionId?: string;
  correctMatches?: Array<{ cardA: string; cardB: string }>;
  explanation?: string;
  treasureCompletes?: boolean;
}

const now = () => Date.now();

function makeDemoQuestions(): DemoQuestion[] {
  const base = { startedAt: now(), serverNow: now(), timeLimitMs: 0, endsAt: null, isTreasure: false, total: 8 };
  return [
    {
      label: 'בחירת ההפך',
      correctOptionId: 'o-small',
      explanation: 'גדול וקטן הם הפכים – פיל הוא גדול, עכבר הוא קטן.',
      view: {
        ...base,
        sessionQuestionId: 'q1',
        index: 0,
        type: QuestionType.CHOOSE_OPPOSITE,
        prompt: 'גדול',
        promptImage: '/images/pairs/big-small/word.svg',
        options: [
          { id: 'o-long', text: 'ארוך' },
          { id: 'o-small', text: 'קטן' },
          { id: 'o-hot', text: 'חם' },
          { id: 'o-fast', text: 'מהיר' },
        ],
      },
    },
    {
      label: 'השלמת משפט',
      correctOptionId: 'o-cold',
      explanation: 'חם וקר הם הפכים. בחורף קר ובקיץ חם.',
      view: {
        ...base,
        sessionQuestionId: 'q2',
        index: 1,
        type: QuestionType.COMPLETE_SENTENCE,
        prompt: 'בקיץ חם, ובחורף ____',
        options: [
          { id: 'o-cold', text: 'קר' },
          { id: 'o-wet', text: 'רטוב' },
          { id: 'o-dark', text: 'חשוך' },
          { id: 'o-slow', text: 'איטי' },
        ],
      },
    },
    {
      label: 'בחירת תמונה',
      correctOptionId: 'o-sad',
      view: {
        ...base,
        sessionQuestionId: 'q3',
        index: 2,
        type: QuestionType.CHOOSE_IMAGE,
        prompt: 'שמח',
        promptImage: '/images/pairs/happy-sad/word.svg',
        options: [
          { id: 'o-day', text: 'יום', image: '/images/pairs/day-night/word.svg' },
          { id: 'o-sad', text: 'עצוב', image: '/images/pairs/happy-sad/opposite.svg' },
          { id: 'o-full', text: 'מלא', image: '/images/pairs/full-empty/word.svg' },
          { id: 'o-cold2', text: 'קר', image: '/images/pairs/hot-cold/opposite.svg' },
        ],
      },
    },
    {
      label: 'תמונה מול תמונה',
      correctOptionId: 'p-small',
      view: {
        ...base,
        sessionQuestionId: 'q8',
        index: 7,
        type: QuestionType.PICTURE_TO_PICTURE,
        prompt: 'גדול',
        promptImage: '/images/pairs/big-small/word.svg',
        options: [
          { id: 'p-cold', text: 'קר', image: '/images/pairs/hot-cold/opposite.svg' },
          { id: 'p-small', text: 'קטן', image: '/images/pairs/big-small/opposite.svg' },
          { id: 'p-fast', text: 'מהיר', image: '/images/pairs/fast-slow/word.svg' },
          { id: 'p-night', text: 'לילה', image: '/images/pairs/day-night/opposite.svg' },
        ],
      },
    },
    {
      label: 'התאמת זוגות',
      correctMatches: [
        { cardA: 'c-big', cardB: 'c-small' },
        { cardA: 'c-hot', cardB: 'c-cold' },
        { cardA: 'c-happy', cardB: 'c-sad' },
        { cardA: 'c-fast', cardB: 'c-slow' },
      ],
      view: {
        ...base,
        sessionQuestionId: 'q4',
        index: 3,
        type: QuestionType.MATCH_PAIRS,
        prompt: 'חברו כל מילה להפך שלה',
        options: [],
        matchPairsCount: 4,
        matchCards: [
          { id: 'c-cold', text: 'קר' },
          { id: 'c-big', text: 'גדול' },
          { id: 'c-sad', text: 'עצוב' },
          { id: 'c-fast', text: 'מהיר' },
          { id: 'c-small', text: 'קטן' },
          { id: 'c-happy', text: 'שמח' },
          { id: 'c-slow', text: 'איטי' },
          { id: 'c-hot', text: 'חם' },
        ],
      },
    },
    {
      label: 'אוצר – שלב 3',
      correctOptionId: 'o-down',
      view: {
        ...base,
        sessionQuestionId: 'q5',
        index: 4,
        type: QuestionType.CHOOSE_OPPOSITE,
        prompt: 'למעלה',
        promptImage: '/images/pairs/up-down/word.svg',
        isTreasure: true,
        treasureStep: 3,
        treasureTotal: 5,
        timeLimitMs: 20000,
        endsAt: now() + 20000,
        options: [
          { id: 'o-down', text: 'למטה' },
          { id: 'o-near', text: 'קרוב' },
          { id: 'o-in', text: 'בפנים' },
          { id: 'o-right', text: 'ימין' },
        ],
      },
    },
    {
      label: 'אוצר – שלב 5 (סיום)',
      correctOptionId: 'o-empty',
      treasureCompletes: true,
      view: {
        ...base,
        sessionQuestionId: 'q6',
        index: 5,
        type: QuestionType.COMPLETE_SENTENCE,
        prompt: 'הכוס הייתה מלאה ועכשיו היא ____',
        isTreasure: true,
        treasureStep: 5,
        treasureTotal: 5,
        timeLimitMs: 30000,
        endsAt: now() + 30000,
        options: [
          { id: 'o-dirty', text: 'מלוכלכת' },
          { id: 'o-empty', text: 'ריקה' },
          { id: 'o-old', text: 'ישנה' },
          { id: 'o-heavy', text: 'כבדה' },
        ],
      },
    },
    {
      label: 'פג הזמן',
      correctOptionId: 'o-night',
      view: {
        ...base,
        sessionQuestionId: 'q7',
        index: 6,
        type: QuestionType.CHOOSE_OPPOSITE,
        prompt: 'יום',
        timeLimitMs: 15000,
        startedAt: now() - 20000,
        endsAt: now() - 5000,
        options: [
          { id: 'o-night', text: 'לילה' },
          { id: 'o-morning', text: 'בוקר' },
          { id: 'o-summer', text: 'קיץ' },
          { id: 'o-early', text: 'מוקדם' },
        ],
      },
    },
  ];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function GamesDemo() {
  const [questions, setQuestions] = useState<DemoQuestion[]>(() => makeDemoQuestions());
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [showCorrect, setShowCorrect] = useState(true);
  const [totalScore, setTotalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(0);
  const { enabled: sounds, setEnabled: setSounds } = useSound();

  const current = questions[index] ?? questions[0];

  const onAnswer = useCallback(
    async (payload: AnswerPayload): Promise<AnswerResult> => {
      await sleep(500);
      if (!current) throw new Error('no question');
      const q = current.view;
      const elapsed = Math.max(0, now() - q.startedAt);
      let correct = false;
      let score = 0;
      if ('optionId' in payload) {
        correct = payload.optionId === current.correctOptionId;
        score = calculateScore(correct, elapsed, q.timeLimitMs);
      } else {
        const cm = current.correctMatches ?? [];
        const matched = payload.matches.filter((m) =>
          cm.some((c) => (c.cardA === m.cardA && c.cardB === m.cardB) || (c.cardA === m.cardB && c.cardB === m.cardA)),
        ).length;
        correct = matched === cm.length;
        score = calculateMatchScore(matched, cm.length, payload.mistakes, elapsed, q.timeLimitMs);
      }
      const nextStreak = correct ? streak + 1 : 0;
      const treasureCompleted = correct && !!current.treasureCompletes;
      const awarded = score + (treasureCompleted ? TREASURE_BONUS : 0);
      const r: AnswerResult = {
        sessionQuestionId: q.sessionQuestionId,
        correct,
        scoreAwarded: awarded,
        totalScore: totalScore + awarded,
        correctOptionId: current.correctOptionId,
        correctMatches: current.correctMatches,
        explanation: current.explanation,
        elapsedMs: elapsed,
        streak: nextStreak,
        treasureCompleted: treasureCompleted || undefined,
        treasureBonus: treasureCompleted ? TREASURE_BONUS : undefined,
      };
      setStreak(nextStreak);
      setTotalScore(r.totalScore);
      setResult(r);
      return r;
    },
    [current, streak, totalScore],
  );

  const goTo = useCallback(
    (i: number) => {
      setResult(null);
      const next = makeDemoQuestions();
      setQuestions(next);
      setIndex(((i % next.length) + next.length) % next.length);
      setRound((r) => r + 1);
    },
    [],
  );

  const onNext = useCallback(() => goTo(index + 1), [goTo, index]);

  const rendererKey = useMemo(() => `${round}-${index}`, [round, index]);

  if (!current) return null;

  return (
    <div dir="rtl" className="relative min-h-dvh overflow-x-clip pb-10">
      <PageBackground variant="day" rainbow={false} balloons={false} />
      <header className="z-40 border-b border-white/70 glass px-3 py-2 sm:sticky sm:top-0">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          <h1 className="me-2 text-lg font-black text-violet-700">🎮 דמו משחקים</h1>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="סוגי שאלות">
            {questions.map((q, i) => (
              <button
                key={q.view.sessionQuestionId}
                role="tab"
                aria-selected={i === index}
                onClick={() => goTo(i)}
                className={cn(
                  'rounded-full px-3 py-1 text-sm font-bold transition-colors',
                  i === index
                    ? 'bg-gradient-to-b from-violet-500 to-violet-700 text-white shadow-[0_6px_12px_-6px_rgba(109,40,217,0.7),inset_0_1px_0_rgba(255,255,255,0.4)]'
                    : 'bg-white/80 text-violet-800 ring-1 ring-violet-200 hover:bg-violet-50',
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
          <div className="ms-auto flex items-center gap-2 text-sm font-bold text-slate-600">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showCorrect} onChange={(e) => setShowCorrect(e.target.checked)} />
              הצג תשובה נכונה
            </label>
            <button
              type="button"
              onClick={() => setSounds(!sounds)}
              aria-pressed={sounds}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200"
            >
              {sounds ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {sounds ? 'צלילים פועלים' : 'צלילים כבויים'}
            </button>
            <button type="button" onClick={() => goTo(index)} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200">
              <RotateCcw className="h-4 w-4" />
              איפוס
            </button>
            <span className="rounded-full bg-yellow-200 px-3 py-1 text-yellow-900">⭐ {totalScore}</span>
          </div>
        </div>
      </header>

      <p className="mx-auto mt-3 max-w-3xl px-4 text-center text-sm font-bold text-slate-500">
        {QUESTION_TYPE_LABELS[current.view.type]} · שאלה {current.view.index + 1} מתוך {current.view.total}
      </p>

      <QuestionRenderer
        key={rendererKey}
        question={current.view}
        result={result}
        onAnswer={onAnswer}
        onNext={onNext}
        soundsEnabled
        showCorrectAnswers={showCorrect}
        serverOffsetMs={0}
      />
    </div>
  );
}

export default GamesDemo;
