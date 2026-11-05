import { BASE_SCORE, MAX_SPEED_BONUS } from './constants';

/**
 * אלגוריתם הניקוד האחיד – מחושב בשרת בלבד.
 * תשובה נכונה: 100 נקודות + בונוס מהירות עד 50.
 * ללא הגבלת זמן (maxTimeMs <= 0): 100 בלבד.
 */
export function calculateScore(correct: boolean, elapsedMs: number, maxTimeMs: number): number {
  if (!correct) return 0;
  if (maxTimeMs <= 0) return BASE_SCORE;
  const remaining = Math.max(0, maxTimeMs - Math.max(0, elapsedMs));
  const bonus = Math.floor((remaining / maxTimeMs) * MAX_SPEED_BONUS);
  return BASE_SCORE + bonus;
}

/** ניקוד התאמת זוגות: ניקוד לכל התאמה + בונוס אם לא היו טעויות */
export function calculateMatchScore(
  pairsMatched: number,
  totalPairs: number,
  mistakes: number,
  elapsedMs: number,
  maxTimeMs: number,
): number {
  if (pairsMatched <= 0) return 0;
  const perPair = Math.round(BASE_SCORE / totalPairs);
  let score = perPair * pairsMatched;
  if (pairsMatched === totalPairs) {
    const perfectBonus = mistakes === 0 ? MAX_SPEED_BONUS : mistakes <= 2 ? Math.floor(MAX_SPEED_BONUS / 2) : 0;
    score += perfectBonus;
    if (maxTimeMs > 0) {
      const remaining = Math.max(0, maxTimeMs - Math.max(0, elapsedMs));
      score += Math.floor((remaining / maxTimeMs) * 25);
    }
  }
  return score;
}
