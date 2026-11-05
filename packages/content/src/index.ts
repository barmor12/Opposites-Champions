import type { Category, DifficultySetting, QuestionType, WordPairContent } from '@oc/shared';
import { WORD_PAIRS } from './wordPairs';

export {
  WORD_PAIRS,
  IMAGEABLE_PAIRS,
  IMAGE_PAIR_SLUGS,
  ABSTRACT_QUESTION_TYPES,
  IMAGEABLE_QUESTION_TYPES,
  wordImagePath,
  oppositeImagePath,
} from './wordPairs';
export { pickDistractors, seededRng, shuffle, synonymsOf, SYNONYM_GROUPS } from './distractors';
export { ASSET_MANIFEST, CHARACTER_ASSETS, getAssetsByKind } from './assetManifest';
export type { AssetKind, AssetManifestEntry } from './assetManifest';

export interface PairFilter {
  categories?: Category[];
  difficulty?: DifficultySetting;
  types?: QuestionType[];
}

/** כל הזוגות (פעילים ולא פעילים) בקטגוריה נתונה. */
export function getPairsByCategory(category: Category): WordPairContent[] {
  return WORD_PAIRS.filter((p) => p.category === category);
}

/**
 * הזוגות הפעילים שמתאימים לסינון:
 * - categories: רשימה ריקה / חסרה = כל הקטגוריות
 * - difficulty: 'MIXED' או חסר = כל הרמות
 * - types: הזוג חייב לתמוך לפחות באחד מסוגי השאלה המבוקשים
 *   (TREASURE_CHALLENGE אינו מופיע ברשימת הסוגים של זוג ולכן מתעלמים ממנו).
 */
export function getActivePairs(filter: PairFilter = {}): WordPairContent[] {
  const categories = filter.categories && filter.categories.length > 0 ? new Set(filter.categories) : null;
  const difficulty = filter.difficulty && filter.difficulty !== 'MIXED' ? filter.difficulty : null;
  const types = filter.types ? filter.types.filter((t) => t !== 'TREASURE_CHALLENGE') : [];

  return WORD_PAIRS.filter((p) => {
    if (!p.active) return false;
    if (categories && !categories.has(p.category)) return false;
    if (difficulty && p.difficulty !== difficulty) return false;
    if (types.length > 0 && !types.some((t) => p.supportedTypes.includes(t))) return false;
    return true;
  });
}
