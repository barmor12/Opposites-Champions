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

export function isJoinable(state: GameState, joinOpen: boolean): boolean {
  return joinOpen && (state === GameState.WAITING_FOR_PLAYERS || state === GameState.CREATED);
}
