import { QuestionType } from './enums';
import type { GameSettings } from './types';

/**
 * מצב תוכן – "למי מיועד המשחק". המורה בוחרת לפי שכבת הגיל של הילדים:
 * - PICTURES: תמונות בלבד, ללא קריאה בכלל (גן–כיתה א׳).
 * - MIXED:    מילים + תמונות (כיתות א׳–ב׳ / קוראים מתחילים).
 * - WORDS:    מילים בלבד, כולל משפטים (כיתה ג׳ ומעלה / קוראים שוטפים).
 * המצב אינו נשמר כשדה נפרד – הוא נגזר מסוגי השאלות (ראו contentModeOf), כך שהגדרות
 * ישנות וממשקים אחרים (API, דוחות) ממשיכים לעבוד ללא שינוי.
 */
export const ContentMode = { PICTURES: 'PICTURES', MIXED: 'MIXED', WORDS: 'WORDS' } as const;
export type ContentMode = (typeof ContentMode)[keyof typeof ContentMode];

/** סוגי שאלות שמציגים איורים (לפחות בחלק מהשאלה) */
export const IMAGE_QUESTION_TYPES: readonly QuestionType[] = [QuestionType.CHOOSE_IMAGE, QuestionType.PICTURE_TO_PICTURE];
/** סוגי שאלות שדורשים קריאת מילים */
export const TEXT_QUESTION_TYPES: readonly QuestionType[] = [QuestionType.CHOOSE_OPPOSITE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE];

export interface ContentModeInfo {
  label: string;
  /** שכבת הגיל המומלצת – מוצג כתת־כותרת */
  ages: string;
  description: string;
}

export const CONTENT_MODE_LABELS: Record<ContentMode, ContentModeInfo> = {
  PICTURES: {
    label: 'תמונות בלבד',
    ages: 'גן – כיתה א׳',
    description: 'ללא קריאה בכלל: השאלה והתשובות הן איורים גדולים וברורים, עם הקראה קולית. רמה קלה וללא הגבלת זמן.',
  },
  MIXED: {
    label: 'מילים ותמונות',
    ages: 'כיתות א׳ – ב׳',
    description: 'שילוב של מילים ואיורים: בחירת ההפך, בחירת תמונה, תמונה מול תמונה והתאמת זוגות.',
  },
  WORDS: {
    label: 'מילים בלבד',
    ages: 'כיתה ג׳ ומעלה',
    description: 'קריאה שוטפת: בחירת ההפך, התאמת זוגות והשלמת משפטים – ללא איורים.',
  },
};

/** ההגדרות שכל מצב תוכן מחיל על הטופס (שאר ההגדרות נשארות כפי שהמורה בחרה) */
export const CONTENT_MODE_PRESETS: Record<ContentMode, Partial<GameSettings>> = {
  PICTURES: {
    questionTypes: [QuestionType.PICTURE_TO_PICTURE],
    difficulty: 'EASY',
    timePerQuestionSec: 0,
    showCorrectAnswers: true,
    treasureChallenge: false,
  },
  MIXED: {
    questionTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.PICTURE_TO_PICTURE, QuestionType.MATCH_PAIRS],
    difficulty: 'MIXED',
    timePerQuestionSec: 20,
  },
  WORDS: {
    questionTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE],
    difficulty: 'MIXED',
    timePerQuestionSec: 20,
  },
};

/**
 * גוזר את מצב התוכן מסוגי השאלות (אתגר האוצר אינו נחשב):
 * רק תמונה-מול-תמונה → PICTURES; ללא סוגי תמונה → WORDS; אחרת → MIXED.
 * רשימה ריקה → null.
 */
export function contentModeOf(settings: Pick<GameSettings, 'questionTypes'>): ContentMode | null {
  const types = settings.questionTypes.filter((t) => t !== QuestionType.TREASURE_CHALLENGE);
  if (types.length === 0) return null;
  if (types.every((t) => t === QuestionType.PICTURE_TO_PICTURE)) return ContentMode.PICTURES;
  if (types.every((t) => !IMAGE_QUESTION_TYPES.includes(t))) return ContentMode.WORDS;
  return ContentMode.MIXED;
}

/**
 * פריסט "רמה קלה – תמונות בלבד": משחק ללא קריאה בכלל.
 * השאלה וכל האפשרויות הן איורים (PICTURE_TO_PICTURE), רמת קושי קלה, ללא הגבלת זמן,
 * הצגת תשובות נכונות פעילה ואתגר האוצר כבוי. שאר ההגדרות (שם כיתה, קטגוריות, מצב וכו') נשארות כפי שהמורה בחרה.
 * (זהה ל־CONTENT_MODE_PRESETS.PICTURES; נשמר לתאימות.)
 */
export const EASY_PICTURE_PRESET: Partial<GameSettings> = CONTENT_MODE_PRESETS.PICTURES;

export const EASY_PICTURE_PRESET_LABEL = 'רמה קלה – תמונות בלבד';

/** האם ההגדרות מתארות משחק "ללא קריאה" (כל סוגי השאלות הם תמונה מול תמונה) */
export function isPictureOnlySettings(settings: Pick<GameSettings, 'questionTypes'>): boolean {
  return contentModeOf(settings) === ContentMode.PICTURES;
}
