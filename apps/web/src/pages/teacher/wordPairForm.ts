import { Category, Difficulty, QuestionType } from '@oc/shared';
import type { WordPairInput } from '@/services/teacherApi';

export const BLANK = '____';

export const EMPTY_FORM: WordPairInput = {
  word: '',
  opposite: '',
  category: Category.SIZES,
  difficulty: Difficulty.EASY,
  sentence: '',
  sentenceAnswer: 'opposite',
  explanation: '',
  imageable: false,
  wordImage: '',
  oppositeImage: '',
  supportedTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE],
  active: true,
};

export type WordPairFormErrors = Partial<Record<keyof WordPairInput, string>>;

export function validateWordPair(f: WordPairInput): WordPairFormErrors {
  const e: WordPairFormErrors = {};
  if (!f.word.trim()) e.word = 'יש להזין מילה';
  if (!f.opposite.trim()) e.opposite = 'יש להזין את ההפך';
  if (f.word.trim() && f.word.trim() === f.opposite.trim()) e.opposite = 'ההפך חייב להיות שונה מהמילה';
  if (!f.sentence.trim()) e.sentence = 'יש להזין משפט דוגמה';
  else if (!f.sentence.includes(BLANK)) e.sentence = `המשפט חייב להכיל ${BLANK} במקום המילה החסרה`;
  if (f.supportedTypes.length === 0) e.supportedTypes = 'יש לבחור לפחות סוג שאלה אחד';
  if (f.imageable) {
    if (!f.wordImage?.trim()) e.wordImage = 'יש להזין נתיב תמונה למילה';
    if (!f.oppositeImage?.trim()) e.oppositeImage = 'יש להזין נתיב תמונה להפך';
  } else if (f.supportedTypes.includes(QuestionType.CHOOSE_IMAGE)) {
    e.supportedTypes = '״בחירת תמונה״ דורשת זוג שניתן להמחשה בתמונה';
  }
  return e;
}
