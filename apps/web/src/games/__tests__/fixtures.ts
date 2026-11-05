import { QuestionType, type AnswerResult, type QuestionView } from '@oc/shared';

export function choiceQuestion(over: Partial<QuestionView> = {}): QuestionView {
  const now = Date.now();
  return {
    sessionQuestionId: 'sq-1',
    index: 0,
    total: 10,
    type: QuestionType.CHOOSE_OPPOSITE,
    prompt: 'גָּדוֹל',
    options: [
      { id: 'a', text: 'אָרוֹךְ' },
      { id: 'b', text: 'קָטָן' },
      { id: 'c', text: 'חַם' },
      { id: 'd', text: 'מָהִיר' },
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
    prompt: 'חֲבֵרוֹ',
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
