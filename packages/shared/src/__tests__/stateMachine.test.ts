import { describe, expect, it } from 'vitest';
import { GameState } from '../enums';
import { isJoinable } from '../stateMachine';

describe('isJoinable', () => {
  it('allows joining while waiting and during an active game (late join)', () => {
    for (const s of [GameState.CREATED, GameState.WAITING_FOR_PLAYERS, GameState.COUNTDOWN, GameState.QUESTION_ACTIVE, GameState.QUESTION_RESULTS, GameState.NEXT_QUESTION, GameState.PAUSED]) {
      expect(isJoinable(s, true), s).toBe(true);
    }
  });
  it('never allows joining when the teacher closed the door or the game is over', () => {
    expect(isJoinable(GameState.QUESTION_ACTIVE, false)).toBe(false);
    for (const s of [GameState.FINAL_RESULTS, GameState.COMPLETED, GameState.CANCELLED, GameState.EXPIRED]) expect(isJoinable(s, true), s).toBe(false);
  });
});
