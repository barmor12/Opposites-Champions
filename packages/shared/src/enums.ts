/** מצבי מנוע המשחק – מעברים מתבצעים בשרת בלבד */
export const GameState = {
  CREATED: 'CREATED',
  WAITING_FOR_PLAYERS: 'WAITING_FOR_PLAYERS',
  COUNTDOWN: 'COUNTDOWN',
  QUESTION_ACTIVE: 'QUESTION_ACTIVE',
  QUESTION_RESULTS: 'QUESTION_RESULTS',
  NEXT_QUESTION: 'NEXT_QUESTION',
  FINAL_RESULTS: 'FINAL_RESULTS',
  COMPLETED: 'COMPLETED',
  PAUSED: 'PAUSED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;
export type GameState = (typeof GameState)[keyof typeof GameState];

export const GameMode = { SELF_PACED: 'SELF_PACED', TEACHER_PACED: 'TEACHER_PACED' } as const;
export type GameMode = (typeof GameMode)[keyof typeof GameMode];

export const QuestionType = {
  CHOOSE_OPPOSITE: 'CHOOSE_OPPOSITE',
  CHOOSE_IMAGE: 'CHOOSE_IMAGE',
  MATCH_PAIRS: 'MATCH_PAIRS',
  COMPLETE_SENTENCE: 'COMPLETE_SENTENCE',
  /** רמה קלה ללא קריאה: השאלה וכל 4 האפשרויות הן איורים בלבד (זוגות imageable) */
  PICTURE_TO_PICTURE: 'PICTURE_TO_PICTURE',
  TREASURE_CHALLENGE: 'TREASURE_CHALLENGE',
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export const Difficulty = { EASY: 'EASY', MEDIUM: 'MEDIUM', HARD: 'HARD' } as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];
export type DifficultySetting = Difficulty | 'MIXED';

export const Category = {
  SIZES: 'SIZES',
  COLORS_LIGHT: 'COLORS_LIGHT',
  EMOTIONS: 'EMOTIONS',
  ACTIONS: 'ACTIONS',
  TIME_SPEED: 'TIME_SPEED',
  DIRECTIONS_PLACES: 'DIRECTIONS_PLACES',
  ANIMALS_NATURE: 'ANIMALS_NATURE',
  TRAITS_STATES: 'TRAITS_STATES',
  OBJECTS_ENVIRONMENT: 'OBJECTS_ENVIRONMENT',
  CHALLENGING: 'CHALLENGING',
} as const;
export type Category = (typeof Category)[keyof typeof Category];

export const CATEGORY_LABELS: Record<Category, string> = {
  SIZES: 'גדלים ומידות',
  COLORS_LIGHT: 'צבעים ואור',
  EMOTIONS: 'רגשות',
  ACTIONS: 'פעולות',
  TIME_SPEED: 'זמן ומהירות',
  DIRECTIONS_PLACES: 'כיוונים ומקומות',
  ANIMALS_NATURE: 'בעלי חיים והמחשות',
  TRAITS_STATES: 'תכונות ומצבים',
  OBJECTS_ENVIRONMENT: 'חפצים וסביבה',
  CHALLENGING: 'מילים מאתגרות לכיתה ג׳',
};

export const DIFFICULTY_LABELS: Record<DifficultySetting, string> = {
  EASY: 'קל',
  MEDIUM: 'בינוני',
  HARD: 'קשה',
  MIXED: 'מעורב',
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  CHOOSE_OPPOSITE: 'בחירת ההפך',
  CHOOSE_IMAGE: 'בחירת תמונה',
  MATCH_PAIRS: 'התאמת זוגות',
  COMPLETE_SENTENCE: 'השלמת משפטים',
  PICTURE_TO_PICTURE: 'תמונה מול תמונה (ללא קריאה)',
  TREASURE_CHALLENGE: 'אתגר האוצר',
};

/** תיאור קצר לכל סוג שאלה – מוצג למורה בעמוד יצירת משחק */
export const QUESTION_TYPE_DESCRIPTIONS: Record<QuestionType, string> = {
  CHOOSE_OPPOSITE: 'מוצגת מילה ויש לבחור את ההפך שלה מבין 4 מילים',
  CHOOSE_IMAGE: 'מוצגת מילה ויש לבחור את האיור של ההפך שלה',
  MATCH_PAIRS: 'מחברים 4 זוגות של מילים מנוגדות מתוך 8 כרטיסים',
  COMPLETE_SENTENCE: 'משלימים משפט עם המילה המנוגדת המתאימה',
  PICTURE_TO_PICTURE: 'השאלה והתשובות הן איורים בלבד – מתאים למי שעדיין לא קורא',
  TREASURE_CHALLENGE: '5 שאלות אחרונות ברצף – תשובות נכונות בכולן מזכות בבונוס',
};

export const AchievementType = {
  OPPOSITES_CHAMPION: 'OPPOSITES_CHAMPION',
  PERSISTENCE_CHAMPION: 'PERSISTENCE_CHAMPION',
  TEN_CORRECT: 'TEN_CORRECT',
  FIVE_STREAK: 'FIVE_STREAK',
  ACCURACY_CHAMPION: 'ACCURACY_CHAMPION',
  PERSONAL_BEST: 'PERSONAL_BEST',
} as const;
export type AchievementType = (typeof AchievementType)[keyof typeof AchievementType];

export const ACHIEVEMENT_LABELS: Record<AchievementType, { title: string; description: string; emoji: string }> = {
  OPPOSITES_CHAMPION: { title: 'אַלּוּף הַהֲפָכִים', description: 'הַמָּקוֹם הָרִאשׁוֹן בַּכִּיתָּה!', emoji: '🏆' },
  PERSISTENCE_CHAMPION: { title: 'אַלּוּף הַהַתְמָדָה', description: 'עָנִיתָ עַל כָּל הַשְּׁאֵלוֹת עַד הַסּוֹף', emoji: '💪' },
  TEN_CORRECT: { title: 'עָשָׂר תְּשׁוּבוֹת נְכוֹנוֹת', description: 'עָשָׂר תְּשׁוּבוֹת נְכוֹנוֹת בְּמִשְׂחָק אֶחָד', emoji: '🔟' },
  FIVE_STREAK: { title: 'חָמֵשׁ בְּרֶצֶף', description: 'חָמֵשׁ תְּשׁוּבוֹת נְכוֹנוֹת בְּרֶצֶף', emoji: '🔥' },
  ACCURACY_CHAMPION: { title: 'אַלּוּף הַדִּיּוּק', description: 'לְפָחוֹת 90% תְּשׁוּבוֹת נְכוֹנוֹת', emoji: '🎯' },
  PERSONAL_BEST: { title: 'שִׂיא אִישִׁי', description: 'הַנִּיקּוּד הַגָּבוֹהַּ בְּיוֹתֵר שֶׁלְּךָ עַד הַיּוֹם', emoji: '⭐' },
};
