import type { Category, DifficultySetting, QuestionType, WordPairContent } from '@oc/shared';

/** A word pair as served by the API: `id` is the DB uuid, `slug` the stable content id. */
export interface WordPairRecord extends WordPairContent {
  slug: string;
}

export interface WordPairListResult {
  items: WordPairRecord[];
  total: number;
}

export interface CategorySummary {
  id: Category;
  label: string;
  count: number;
}

export interface MediaAssetView {
  key: string;
  kind: string;
  url: string;
  alt: string;
}

/** Filter used by the game engine to pick pairs for a session (same shape as `@oc/content` PairFilter). */
export interface PlayablePairFilter {
  /** Empty / missing = all categories. */
  categories?: Category[];
  /** 'MIXED' / missing = all difficulties. */
  difficulty?: DifficultySetting;
  /** Keep only pairs supporting at least one of these types (TREASURE_CHALLENGE ignored). */
  types?: QuestionType[];
  /** Keep only pairs that have both images (for CHOOSE_IMAGE). */
  requireImages?: boolean;
}
