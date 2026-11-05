export interface RankableEntry {
  participantId: string;
  score: number;
  correctAnswers: number;
  totalResponseMs: number;
}

export interface RankedEntry<T extends RankableEntry = RankableEntry> {
  entry: T;
  rank: number;
}

/**
 * הכרעת שוויון: ניקוד > תשובות נכונות > זמן תגובה מצטבר נמוך > דירוג משותף.
 * אין שימוש בסדר ההצטרפות.
 */
export function compareEntries(a: RankableEntry, b: RankableEntry): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;
  return a.totalResponseMs - b.totalResponseMs;
}

export function rankEntries<T extends RankableEntry>(entries: T[]): RankedEntry<T>[] {
  const sorted = [...entries].sort((a, b) => {
    const c = compareEntries(a, b);
    return c !== 0 ? c : a.participantId.localeCompare(b.participantId); // יציבות בלבד, לא משפיע על rank
  });
  const ranked: RankedEntry<T>[] = [];
  let prev: T | undefined;
  let prevRank = 0;
  sorted.forEach((entry, i) => {
    const rank = prev && compareEntries(prev, entry) === 0 ? prevRank : i + 1;
    ranked.push({ entry, rank });
    prev = entry;
    prevRank = rank;
  });
  return ranked;
}
