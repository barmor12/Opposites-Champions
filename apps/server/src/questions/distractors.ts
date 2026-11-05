import { shuffle, type Rng } from './rng';

/**
 * בחירת מסיחים – מימוש פרטי (תואם לחתימה המתוכננת ב־@oc/content: pickDistractors(pair, all, count, rng)).
 * עדיפות: אותה קטגוריה > אותה רמת קושי > כל השאר. לא נבחרים זוגות שחולקים מילה עם הזוג הנשאל.
 */
export interface DistractorPair {
  id: string;
  word: string;
  opposite: string;
  category: string;
  difficulty: string;
}

export function pickDistractors<T extends DistractorPair>(pair: T, all: readonly T[], count: number, rng: Rng): T[] {
  const forbidden = new Set([pair.word, pair.opposite]);
  const candidates = all.filter((p) => p.id !== pair.id && !forbidden.has(p.word) && !forbidden.has(p.opposite));
  const tiers: T[][] = [
    candidates.filter((p) => p.category === pair.category && p.difficulty === pair.difficulty),
    candidates.filter((p) => p.category === pair.category && p.difficulty !== pair.difficulty),
    candidates.filter((p) => p.category !== pair.category && p.difficulty === pair.difficulty),
    candidates.filter((p) => p.category !== pair.category && p.difficulty !== pair.difficulty),
  ];
  const chosen: T[] = [];
  const seenTexts = new Set<string>(forbidden);
  for (const tier of tiers) {
    for (const candidate of shuffle(tier, rng)) {
      if (chosen.length >= count) break;
      if (seenTexts.has(candidate.word) || seenTexts.has(candidate.opposite)) continue;
      chosen.push(candidate);
      seenTexts.add(candidate.word);
      seenTexts.add(candidate.opposite);
    }
    if (chosen.length >= count) break;
  }
  return chosen;
}
