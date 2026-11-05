import type {
  AchievementType, Category, Difficulty, DifficultySetting, GameMode, GameState, QuestionType,
} from './enums';
import type { AvatarId } from './constants';

// ===== תוכן =====
export interface WordPairContent {
  id: string; // slug ייחודי
  word: string;
  opposite: string;
  category: Category;
  difficulty: Difficulty;
  sentence: string; // משפט דוגמה עם ____ במקום המילה המנוגדת
  sentenceAnswer: 'word' | 'opposite'; // איזו מילה משלימה את המשפט
  explanation?: string;
  imageable: boolean; // האם ניתן להמחשה בתמונה
  wordImage?: string;
  oppositeImage?: string;
  supportedTypes: QuestionType[];
  active: boolean;
}

// ===== הגדרות משחק =====
export interface GameSettings {
  className: string;
  questionCount: number;
  difficulty: DifficultySetting;
  categories: Category[];
  timePerQuestionSec: number; // 0 = ללא הגבלה
  questionTypes: QuestionType[];
  mode: GameMode;
  competitionEnabled: boolean;
  showLeaderboard: boolean;
  showCorrectAnswers: boolean;
  soundsEnabled: boolean;
  treasureChallenge: boolean;
}

// ===== שאלות ללקוח (ללא תשובה נכונה) =====
export interface QuestionOptionView {
  id: string;
  text: string;
  image?: string;
}

export interface MatchCardView {
  id: string;
  text: string;
  image?: string;
}

export interface QuestionView {
  sessionQuestionId: string;
  index: number; // 0-based
  total: number;
  type: QuestionType;
  prompt: string; // המילה / המשפט
  promptImage?: string;
  explanationHint?: string;
  options: QuestionOptionView[]; // לסוגים 1,2,4
  matchCards?: MatchCardView[]; // לסוג 3 – קלפים מעורבבים
  matchPairsCount?: number;
  isTreasure: boolean;
  treasureStep?: number; // 1..5
  treasureTotal?: number;
  timeLimitMs: number; // 0 = ללא הגבלה
  startedAt: number; // server epoch ms
  endsAt: number | null;
  serverNow: number;
}

// ===== תשובות =====
export interface ChoiceAnswerPayload {
  sessionQuestionId: string;
  optionId: string;
}
export interface MatchAnswerPayload {
  sessionQuestionId: string;
  matches: Array<{ cardA: string; cardB: string }>; // זוגות שהתלמיד חיבר
  mistakes: number; // מדווח מהלקוח לצורך UX בלבד; הניקוד מחושב בשרת לפי ההתאמות
}
export type AnswerPayload = ChoiceAnswerPayload | MatchAnswerPayload;

export interface AnswerResult {
  sessionQuestionId: string;
  correct: boolean;
  scoreAwarded: number;
  totalScore: number;
  correctOptionId?: string;
  correctMatches?: Array<{ cardA: string; cardB: string }>;
  explanation?: string;
  elapsedMs: number;
  streak: number;
  treasureCompleted?: boolean;
  treasureBonus?: number;
}

// ===== דירוג =====
export interface LeaderboardEntry {
  participantId: string;
  displayName: string;
  avatar: AvatarId;
  score: number;
  correctAnswers: number;
  answeredCount: number;
  accuracy: number; // 0-100
  totalResponseMs: number;
  rank: number;
  connected: boolean;
  finished: boolean;
}

export interface Leaderboard {
  gameSessionId: string;
  entries: LeaderboardEntry[];
  updatedAt: number;
}

export interface AchievementAward {
  type: AchievementType;
  participantId: string;
}

// ===== חדר ומשתתפים =====
export interface ParticipantView {
  id: string;
  displayName: string;
  avatar: AvatarId;
  connected: boolean;
  finished: boolean;
  answeredCount: number;
  score: number;
}

export interface RoomPublicView {
  roomId: string;
  code: string;
  className: string;
  state: GameState;
  joinOpen: boolean;
  mode: GameMode;
  participantCount: number;
  questionCount: number;
  currentQuestionIndex: number | null;
  settings: Pick<GameSettings, 'timePerQuestionSec' | 'showLeaderboard' | 'showCorrectAnswers' | 'soundsEnabled' | 'competitionEnabled'>;
}

export interface PlayerSession {
  participantId: string;
  displayName: string;
  avatar: AvatarId;
  room: RoomPublicView;
  gameSessionId: string | null;
  score: number;
  correctAnswers: number;
  answeredCount: number;
  finished: boolean;
  currentQuestion: QuestionView | null;
  lastResult: AnswerResult | null;
  achievements: AchievementType[];
}

export interface JoinRoomRequest {
  code: string;
  displayName: string;
  avatar: AvatarId;
}
export interface JoinRoomResponse {
  participantId: string;
  sessionToken: string;
  displayName: string;
  avatar: AvatarId;
  room: RoomPublicView;
}

// ===== מורה =====
export interface TeacherProfile {
  id: string;
  email: string;
  name: string;
}

export interface GameSummary {
  roomId: string;
  code: string;
  className: string;
  state: GameState;
  joinOpen: boolean;
  mode: GameMode;
  createdAt: string;
  participantCount: number;
  sessionCount: number;
  currentSessionId: string | null;
  settings: GameSettings;
}

export interface QuestionStat {
  sessionQuestionId: string;
  index: number;
  type: QuestionType;
  prompt: string;
  correctAnswerText: string;
  answered: number;
  correct: number;
  accuracy: number;
  distribution: Array<{ text: string; count: number; isCorrect: boolean }>;
}

export interface GameResults {
  roomId: string;
  gameSessionId: string;
  className: string;
  state: GameState;
  startedAt: string | null;
  finishedAt: string | null;
  questionCount: number;
  classAverage: number;
  classAccuracy: number;
  leaderboard: LeaderboardEntry[];
  achievements: Array<{ participantId: string; type: AchievementType }>;
  questionStats: QuestionStat[];
  hardestQuestions: QuestionStat[];
}

export interface TeacherRoomLive {
  room: RoomPublicView;
  participants: ParticipantView[];
  finishedCount: number;
  leaderboard: LeaderboardEntry[];
  gameSessionId: string | null;
  currentQuestionIndex: number | null;
  joinUrl: string;
}
