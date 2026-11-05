import { QuestionType } from './enums';
import type { GameSettings } from './types';

/**
 * פריסט "רמה קלה – תמונות בלבד": משחק ללא קריאה בכלל.
 * השאלה וכל האפשרויות הן איורים (PICTURE_TO_PICTURE), רמת קושי קלה, ללא הגבלת זמן,
 * הצגת תשובות נכונות פעילה ואתגר האוצר כבוי. שאר ההגדרות (שם כיתה, קטגוריות, מצב וכו') נשארות כפי שהמורה בחרה.
 */
export const EASY_PICTURE_PRESET: Partial<GameSettings> = {
  questionTypes: [QuestionType.PICTURE_TO_PICTURE],
  difficulty: 'EASY',
  timePerQuestionSec: 0,
  showCorrectAnswers: true,
  treasureChallenge: false,
};

export const EASY_PICTURE_PRESET_LABEL = 'רמה קלה – תמונות בלבד';

/** האם ההגדרות מתארות משחק "ללא קריאה" (כל סוגי השאלות הם תמונה מול תמונה) */
export function isPictureOnlySettings(settings: Pick<GameSettings, 'questionTypes'>): boolean {
  const types = settings.questionTypes.filter((t) => t !== QuestionType.TREASURE_CHALLENGE);
  return types.length > 0 && types.every((t) => t === QuestionType.PICTURE_TO_PICTURE);
}
