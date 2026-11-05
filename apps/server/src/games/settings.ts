import type { Prisma } from '@prisma/client';
import {
  Category, GameMode, QuestionType, type DifficultySetting, type GameSettings, type Difficulty,
  QUESTION_COUNT_OPTIONS, TIME_PER_QUESTION_OPTIONS,
} from '@oc/shared';

export const DEFAULT_SETTINGS: GameSettings = {
  className: '',
  questionCount: 10,
  difficulty: 'MIXED',
  categories: Object.values(Category),
  timePerQuestionSec: 20,
  questionTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE],
  mode: GameMode.SELF_PACED,
  competitionEnabled: true,
  showLeaderboard: true,
  showCorrectAnswers: true,
  soundsEnabled: true,
  treasureChallenge: false,
};

const CATEGORY_SET = new Set<string>(Object.values(Category));
const TYPE_SET = new Set<string>(Object.values(QuestionType));
const DIFFICULTIES = new Set<string>(['EASY', 'MEDIUM', 'HARD', 'MIXED']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** קורא הגדרות משחק מעמודת JSON בצורה בטוחה (עם ברירות מחדל) */
export function parseSettings(json: Prisma.JsonValue | unknown): GameSettings {
  if (!isRecord(json)) return { ...DEFAULT_SETTINGS };
  const categories = Array.isArray(json.categories)
    ? json.categories.filter((c): c is Category => typeof c === 'string' && CATEGORY_SET.has(c))
    : [];
  const questionTypes = Array.isArray(json.questionTypes)
    ? json.questionTypes.filter((t): t is QuestionType => typeof t === 'string' && TYPE_SET.has(t))
    : [];
  const questionCount = typeof json.questionCount === 'number' && (QUESTION_COUNT_OPTIONS as readonly number[]).includes(json.questionCount)
    ? json.questionCount
    : DEFAULT_SETTINGS.questionCount;
  const timePerQuestionSec = typeof json.timePerQuestionSec === 'number' && (TIME_PER_QUESTION_OPTIONS as readonly number[]).includes(json.timePerQuestionSec)
    ? json.timePerQuestionSec
    : DEFAULT_SETTINGS.timePerQuestionSec;
  const difficulty: DifficultySetting = typeof json.difficulty === 'string' && DIFFICULTIES.has(json.difficulty)
    ? (json.difficulty as Difficulty | 'MIXED')
    : 'MIXED';
  const mode: GameMode = json.mode === GameMode.TEACHER_PACED ? GameMode.TEACHER_PACED : GameMode.SELF_PACED;
  return {
    className: typeof json.className === 'string' ? json.className : '',
    questionCount,
    difficulty,
    categories: categories.length > 0 ? categories : [...DEFAULT_SETTINGS.categories],
    timePerQuestionSec,
    questionTypes: questionTypes.length > 0 ? questionTypes : [...DEFAULT_SETTINGS.questionTypes],
    mode,
    competitionEnabled: bool(json.competitionEnabled, true),
    showLeaderboard: bool(json.showLeaderboard, true),
    showCorrectAnswers: bool(json.showCorrectAnswers, true),
    soundsEnabled: bool(json.soundsEnabled, true),
    treasureChallenge: bool(json.treasureChallenge, false),
  };
}

/** ממיר הגדרות לערך JSON לשמירה ב־Prisma */
export function settingsToJson(settings: GameSettings): Prisma.InputJsonObject {
  return { ...settings } as unknown as Prisma.InputJsonObject;
}
