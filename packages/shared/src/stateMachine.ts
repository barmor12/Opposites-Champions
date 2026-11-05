import { GameState } from './enums';

/** מעברי מצב מותרים – נאכפים בשרת */
export const ALLOWED_TRANSITIONS: Record<GameState, readonly GameState[]> = {
  CREATED: [GameState.WAITING_FOR_PLAYERS, GameState.CANCELLED, GameState.EXPIRED],
  WAITING_FOR_PLAYERS: [GameState.COUNTDOWN, GameState.CANCELLED, GameState.EXPIRED],
  COUNTDOWN: [GameState.QUESTION_ACTIVE, GameState.PAUSED, GameState.CANCELLED],
  QUESTION_ACTIVE: [GameState.QUESTION_RESULTS, GameState.PAUSED, GameState.FINAL_RESULTS, GameState.CANCELLED],
  QUESTION_RESULTS: [GameState.NEXT_QUESTION, GameState.FINAL_RESULTS, GameState.PAUSED, GameState.CANCELLED],
  NEXT_QUESTION: [GameState.QUESTION_ACTIVE, GameState.FINAL_RESULTS, GameState.PAUSED, GameState.CANCELLED],
  FINAL_RESULTS: [GameState.COMPLETED, GameState.WAITING_FOR_PLAYERS],
  COMPLETED: [GameState.WAITING_FOR_PLAYERS],
  PAUSED: [GameState.QUESTION_ACTIVE, GameState.QUESTION_RESULTS, GameState.NEXT_QUESTION, GameState.COUNTDOWN, GameState.FINAL_RESULTS, GameState.CANCELLED],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransition(from: GameState, to: GameState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const ACTIVE_PLAY_STATES: readonly GameState[] = [
  GameState.COUNTDOWN,
  GameState.QUESTION_ACTIVE,
  GameState.QUESTION_RESULTS,
  GameState.NEXT_QUESTION,
];

/** מצבים שבהם תלמיד יכול להצטרף לחדר (כל עוד המורה לא סגרה את ההצטרפות ידנית) – כולל באמצע משחק */
export const JOINABLE_STATES: readonly GameState[] = [
  GameState.CREATED,
  GameState.WAITING_FOR_PLAYERS,
  ...ACTIVE_PLAY_STATES,
  GameState.PAUSED,
];

/**
 * האם אפשר להצטרף לחדר. הצטרפות מאוחרת (אחרי "התחל משחק") מותרת: המצטרף מקבל
 * את השאלה הנוכחית (קצב המורה) או מתחיל מהשאלה הראשונה (קצב אישי).
 */
export function isJoinable(state: GameState, joinOpen: boolean): boolean {
  return joinOpen && JOINABLE_STATES.includes(state);
}
