import { QuestionType, type AnswerResult, type QuestionView } from '@oc/shared';

export function choiceQuestion(over: Partial<QuestionView> = {}): QuestionView {
  const now = Date.now();
  return {
    sessionQuestionId: 'sq-1',
    index: 0,
    total: 10,
    type: QuestionType.CHOOSE_OPPOSITE,
    prompt: 'גדול',
    options: [
      { id: 'a', text: 'ארוך' },
      { id: 'b', text: 'קטן' },
      { id: 'c', text: 'חם' },
      { id: 'd', text: 'מהיר' },
    ],
    isTreasure: false,
    timeLimitMs: 0,
    startedAt: now,
    endsAt: null,
    serverNow: now,
    ...over,
  };
}

export function matchQuestion(over: Partial<QuestionView> = {}): QuestionView {
  return choiceQuestion({
    sessionQuestionId: 'sq-m',
    type: QuestionType.MATCH_PAIRS,
    prompt: 'חברו',
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
    ...over,
  });
}

export function resultFor(q: QuestionView, over: Partial<AnswerResult> = {}): AnswerResult {
  return {
    sessionQuestionId: q.sessionQuestionId,
    correct: true,
    scoreAwarded: 120,
    totalScore: 120,
    elapsedMs: 1200,
    streak: 1,
    ...over,
  };
}

/** jsdom לא מממש canvas – מונע הדפסות "not implemented" */
export function stubCanvas() {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: () => null, configurable: true });
}
