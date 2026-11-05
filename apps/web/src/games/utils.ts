import { QuestionType, type AnswerResult, type QuestionOptionView } from '@oc/shared';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** בחירה דטרמיניסטית מתוך רשימה לפי מחרוזת (כדי שהמשוב לא "יקפוץ" בין רינדורים) */
export function pick<T>(arr: readonly T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length] as T;
}

const TYPE_INSTRUCTION: Record<string, string> = {
  [QuestionType.CHOOSE_OPPOSITE]: 'מה ההפך של המילה?',
  [QuestionType.CHOOSE_IMAGE]: 'איזו תמונה מראה את ההפך?',
  [QuestionType.COMPLETE_SENTENCE]: 'איזו מילה משלימה את המשפט?',
  [QuestionType.MATCH_PAIRS]: 'חברו כל מילה להפך שלה',
  [QuestionType.TREASURE_CHALLENGE]: 'מה ההפך של המילה?',
};

export function promptInstruction(type: QuestionType): string {
  return TYPE_INSTRUCTION[type] ?? 'בחרו את התשובה הנכונה';
}

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

export function samePair(a: { cardA: string; cardB: string }, b: { cardA: string; cardB: string }): boolean {
  return (a.cardA === b.cardA && a.cardB === b.cardB) || (a.cardA === b.cardB && a.cardB === b.cardA);
}
