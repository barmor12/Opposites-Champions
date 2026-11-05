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
      label: 'בְּחִירַת הַהֶפֶךְ',
      correctOptionId: 'o-small',
      explanation: 'גָּדוֹל וְקָטָן הֵם הֲפָכִים – פִּיל הוּא גָּדוֹל, עַכְבָּר הוּא קָטָן.',
      view: {
        ...base,
        sessionQuestionId: 'q1',
        index: 0,
        type: QuestionType.CHOOSE_OPPOSITE,
        prompt: 'גָּדוֹל',
        promptImage: '/images/pairs/big-small/word.svg',
        options: [
          { id: 'o-long', text: 'אָרוֹךְ' },
          { id: 'o-small', text: 'קָטָן' },
          { id: 'o-hot', text: 'חַם' },
          { id: 'o-fast', text: 'מָהִיר' },
        ],
      },
    },
    {
      label: 'הַשְׁלָמַת מִשְׁפָּט',
      correctOptionId: 'o-cold',
      explanation: 'חַם וְקַר הֵם הֲפָכִים. בַּחוֹרֶף קַר וּבַקַּיִץ חַם.',
      view: {
        ...base,
        sessionQuestionId: 'q2',
        index: 1,
        type: QuestionType.COMPLETE_SENTENCE,
        prompt: 'בַּקַּיִץ חַם, וּבַחוֹרֶף ____',
        options: [
          { id: 'o-cold', text: 'קַר' },
          { id: 'o-wet', text: 'רָטוֹב' },
          { id: 'o-dark', text: 'חָשׁוּךְ' },
          { id: 'o-slow', text: 'אִיטִּי' },
        ],
      },
    },
    {
      label: 'בְּחִירַת תְּמוּנָה',
      correctOptionId: 'o-sad',
      view: {
        ...base,
        sessionQuestionId: 'q3',
        index: 2,
        type: QuestionType.CHOOSE_IMAGE,
        prompt: 'שָׂמֵחַ',
        promptImage: '/images/pairs/happy-sad/word.svg',
        options: [
          { id: 'o-day', text: 'יוֹם', image: '/images/pairs/day-night/word.svg' },
          { id: 'o-sad', text: 'עָצוּב', image: '/images/pairs/happy-sad/opposite.svg' },
          { id: 'o-full', text: 'מָלֵא', image: '/images/pairs/full-empty/word.svg' },
          { id: 'o-cold2', text: 'קַר', image: '/images/pairs/hot-cold/opposite.svg' },
        ],
      },
    },
    {
      label: 'תְּמוּנָה מוּל תְּמוּנָה',
      correctOptionId: 'p-small',
      view: {
        ...base,
        sessionQuestionId: 'q8',
        index: 7,
        type: QuestionType.PICTURE_TO_PICTURE,
        prompt: 'גָּדוֹל',
        promptImage: '/images/pairs/big-small/word.svg',
        options: [
          { id: 'p-cold', text: 'קַר', image: '/images/pairs/hot-cold/opposite.svg' },
          { id: 'p-small', text: 'קָטָן', image: '/images/pairs/big-small/opposite.svg' },
          { id: 'p-fast', text: 'מָהִיר', image: '/images/pairs/fast-slow/word.svg' },
          { id: 'p-night', text: 'לַיְלָה', image: '/images/pairs/day-night/opposite.svg' },
        ],
      },
    },
    {
      label: 'הַתְאָמַת זוּגוֹת',
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
        prompt: 'חָבְרוּ כָּל מִילָּה לְהֶפֶךְ שֶׁלָּהּ',
        options: [],
        matchPairsCount: 4,
        matchCards: [
          { id: 'c-cold', text: 'קַר' },
          { id: 'c-big', text: 'גָּדוֹל' },
          { id: 'c-sad', text: 'עָצוּב' },
          { id: 'c-fast', text: 'מָהִיר' },
          { id: 'c-small', text: 'קָטָן' },
          { id: 'c-happy', text: 'שָׂמֵחַ' },
          { id: 'c-slow', text: 'אִיטִּי' },
          { id: 'c-hot', text: 'חַם' },
        ],
      },
    },
    {
      label: 'אוֹצָר – שָׁלָב 3',
      correctOptionId: 'o-down',
      view: {
        ...base,
        sessionQuestionId: 'q5',
        index: 4,
        type: QuestionType.CHOOSE_OPPOSITE,
        prompt: 'לְמַעְלָה',
        promptImage: '/images/pairs/up-down/word.svg',
        isTreasure: true,
        treasureStep: 3,
        treasureTotal: 5,
        timeLimitMs: 20000,
        endsAt: now() + 20000,
        options: [
          { id: 'o-down', text: 'לְמַטָּה' },
          { id: 'o-near', text: 'קָרוֹב' },
          { id: 'o-in', text: 'בִּפְנִים' },
          { id: 'o-right', text: 'יָמִין' },
        ],
      },
    },
    {
      label: 'אוֹצָר – שָׁלָב 5 (סִיּוּם)',
      correctOptionId: 'o-empty',
      treasureCompletes: true,
      view: {
        ...base,
        sessionQuestionId: 'q6',
        index: 5,
        type: QuestionType.COMPLETE_SENTENCE,
        prompt: 'הַכּוֹס הָיְיתָה מְלֵאָה וְעַכְשָׁיו הִיא ____',
        isTreasure: true,
        treasureStep: 5,
        treasureTotal: 5,
        timeLimitMs: 30000,
        endsAt: now() + 30000,
        options: [
          { id: 'o-dirty', text: 'מְלוּכְלֶכֶת' },
          { id: 'o-empty', text: 'רֵיקָה' },
          { id: 'o-old', text: 'יֶשְׁנָהּ' },
          { id: 'o-heavy', text: 'כְּבֵדָה' },
        ],
      },
    },
    {
      label: 'פָּג הַזְּמַן',
      correctOptionId: 'o-night',
      view: {
        ...base,
        sessionQuestionId: 'q7',
        index: 6,
        type: QuestionType.CHOOSE_OPPOSITE,
        prompt: 'יוֹם',
        timeLimitMs: 15000,
        startedAt: now() - 20000,
        endsAt: now() - 5000,
        options: [
          { id: 'o-night', text: 'לַיְלָה' },
          { id: 'o-morning', text: 'בּוֹקֶר' },
          { id: 'o-summer', text: 'קַיִץ' },
          { id: 'o-early', text: 'מוּקְדָּם' },
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
          <h1 className="me-2 text-lg font-black text-violet-700">🎮 דָּמוֹ מִשְׂחָקִים</h1>
          <div className="flex flex-wrap gap-1" role="tablist" aria-label="סוּגֵי שְׁאֵלוֹת">
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
              הַצֵּג תְּשׁוּבָה נְכוֹנָה
            </label>
            <button
              type="button"
              onClick={() => setSounds(!sounds)}
              aria-pressed={sounds}
              className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200"
            >
              {sounds ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              {sounds ? 'צְלִילִים פּוֹעֲלִים' : 'צְלִילִים כְּבוּיִים'}
            </button>
            <button type="button" onClick={() => goTo(index)} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200">
              <RotateCcw className="h-4 w-4" />
              אִיפּוּס
            </button>
            <span className="rounded-full bg-yellow-200 px-3 py-1 text-yellow-900">⭐ {totalScore}</span>
          </div>
        </div>
      </header>

      <p className="mx-auto mt-3 max-w-3xl px-4 text-center text-sm font-bold text-slate-500">
        {QUESTION_TYPE_LABELS[current.view.type]} · שָׁאֲלָה {current.view.index + 1} מִתּוֹךְ {current.view.total}
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
