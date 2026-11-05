import { Category, GameMode, QuestionType, type DifficultySetting, type GameSettings } from '@oc/shared';

export const ALL_CATEGORIES = Object.values(Category);
export const DIFFICULTIES: DifficultySetting[] = ['EASY', 'MEDIUM', 'HARD', 'MIXED'];
/** סוגי השאלות הרגילים – אתגר האוצר נבחר במתג נפרד. */
export const REGULAR_TYPES = Object.values(QuestionType).filter((t) => t !== QuestionType.TREASURE_CHALLENGE);

export const DEFAULT_SETTINGS: GameSettings = {
  className: '',
  questionCount: 12,
  difficulty: 'MIXED',
  categories: [...ALL_CATEGORIES],
  timePerQuestionSec: 20,
  questionTypes: [...REGULAR_TYPES],
  mode: GameMode.SELF_PACED,
  competitionEnabled: true,
  showLeaderboard: true,
  showCorrectAnswers: true,
  soundsEnabled: true,
  treasureChallenge: false,
};

export type GameSettingsErrors = Partial<Record<'className' | 'categories' | 'questionTypes', string>>;

export function validateSettings(s: GameSettings): GameSettingsErrors {
  const errors: GameSettingsErrors = {};
  const name = s.className.trim();
  if (!name) errors.className = 'יש להזין שם כיתה';
  else if (name.length < 2) errors.className = 'שם הכיתה קצר מדי';
  else if (name.length > 40) errors.className = 'שם הכיתה ארוך מדי (עד 40 תווים)';
  if (s.categories.length === 0) errors.categories = 'יש לבחור לפחות קטגוריה אחת';
  if (s.questionTypes.length === 0) errors.questionTypes = 'יש לבחור לפחות סוג שאלה אחד';
  return errors;
}
