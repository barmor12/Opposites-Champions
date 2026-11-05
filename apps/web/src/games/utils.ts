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
  [QuestionType.CHOOSE_OPPOSITE]: 'מָה הַהֶפֶךְ שֶׁל הַמִּילָּה?',
  [QuestionType.CHOOSE_IMAGE]: 'אֵיזוֹ תְּמוּנָה מַרְאָה אֶת הַהֶפֶךְ?',
  [QuestionType.COMPLETE_SENTENCE]: 'אֵיזוֹ מִילָּה מַשְׁלִימָה אֶת הַמִּשְׁפָּט?',
  [QuestionType.MATCH_PAIRS]: 'חָבְרוּ כָּל מִילָּה לְהֶפֶךְ שֶׁלָּהּ',
  [QuestionType.PICTURE_TO_PICTURE]: 'מָצְאוּ אֶת הַתְּמוּנָה הַהֲפוּכָה',
  [QuestionType.TREASURE_CHALLENGE]: 'מָה הַהֶפֶךְ שֶׁל הַמִּילָּה?',
};

export function promptInstruction(type: QuestionType): string {
  return TYPE_INSTRUCTION[type] ?? 'בָּחֲרוּ אֶת הַתְּשׁוּבָה הַנְּכוֹנָה';
}

export type OptionState = 'idle' | 'pending' | 'correct' | 'wrong' | 'reveal' | 'dim';

export function optionState(
  option: QuestionOptionView,
  selectedId: string | null,
  result: AnswerResult | null,
  showCorrectAnswers: boolean,
  expired = false,
): OptionState {
  if (!result) return selectedId === option.id ? 'pending' : expired ? 'dim' : 'idle';
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
