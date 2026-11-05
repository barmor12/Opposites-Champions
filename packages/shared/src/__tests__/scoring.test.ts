import { describe, expect, it } from 'vitest';
import { calculateMatchScore, calculateScore } from '../scoring';
import { rankEntries } from '../ranking';
import { nameKey, validateDisplayName } from '../nameFilter';
import { canTransition } from '../stateMachine';
import { GameState } from '../enums';

describe('calculateScore', () => {
  it('returns 0 for wrong answers', () => expect(calculateScore(false, 100, 20000)).toBe(0));
  it('returns 100 without time limit', () => expect(calculateScore(true, 5000, 0)).toBe(100));
  it('awards full bonus for instant answer', () => expect(calculateScore(true, 0, 20000)).toBe(150));
  it('awards half bonus at half time', () => expect(calculateScore(true, 10000, 20000)).toBe(125));
  it('awards no bonus after time', () => expect(calculateScore(true, 25000, 20000)).toBe(100));
  it('clamps negative elapsed', () => expect(calculateScore(true, -500, 20000)).toBe(150));
});

describe('calculateMatchScore', () => {
  it('gives perfect bonus', () => expect(calculateMatchScore(4, 4, 0, 0, 0)).toBe(150));
  it('gives partial for partial', () => expect(calculateMatchScore(2, 4, 3, 0, 0)).toBe(50));
  it('zero for nothing', () => expect(calculateMatchScore(0, 4, 0, 0, 0)).toBe(0));
});

describe('rankEntries', () => {
  it('ranks by score, correct, time and shares rank on full tie', () => {
    const ranked = rankEntries([
      { participantId: 'a', score: 100, correctAnswers: 1, totalResponseMs: 500 },
      { participantId: 'b', score: 200, correctAnswers: 2, totalResponseMs: 900 },
      { participantId: 'c', score: 200, correctAnswers: 2, totalResponseMs: 300 },
      { participantId: 'd', score: 100, correctAnswers: 1, totalResponseMs: 500 },
    ]);
    expect(ranked.map((r) => [r.entry.participantId, r.rank])).toEqual([
      ['c', 1], ['b', 2], ['a', 3], ['d', 3],
    ]);
  });
});

describe('validateDisplayName', () => {
  it('accepts hebrew names', () => expect(validateDisplayName('  נועה  כהן ').ok).toBe(true));
  it('rejects short', () => expect(validateDisplayName('א').ok).toBe(false));
  it('rejects blocked words', () => expect(validateDisplayName('טיפש123').ok).toBe(false));
  it('rejects symbols', () => expect(validateDisplayName('<script>').ok).toBe(false));
  it('nameKey folds spacing', () => expect(nameKey('נועה כהן')).toBe(nameKey('נועהכהן')));
});

describe('state machine', () => {
  it('allows valid transitions', () => expect(canTransition(GameState.WAITING_FOR_PLAYERS, GameState.COUNTDOWN)).toBe(true));
  it('blocks invalid', () => expect(canTransition(GameState.COMPLETED, GameState.QUESTION_ACTIVE)).toBe(false));
});
