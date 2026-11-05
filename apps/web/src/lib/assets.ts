import type { AvatarId } from '@oc/shared';

export type CharacterName = 'sun' | 'moon';
export type CharacterMood = 'happy' | 'cheer' | 'think';
export type MedalKind = 'gold' | 'silver' | 'bronze';

/**
 * נתיב ל־asset סטטי מתוך `public/`.
 * בפריסה רגילה ה־base הוא `/` והנתיב נשאר מוחלט; בבנייה עם base יחסי (למשל גרסת הדמו המפורסמת)
 * הנתיב הופך ליחסי לדף, כך שהאיורים נטענים גם כשהאפליקציה לא יושבת בשורש הדומיין.
 */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
export function assetUrl(path: string): string {
  if (!path.startsWith('/') || /^\/\//.test(path)) return path;
  return BASE === '' ? path : `${BASE}${path}`;
}

export function avatarSrc(id: AvatarId): string {
  return assetUrl(`/avatars/${id}.svg`);
}

export function characterSrc(name: CharacterName, mood: CharacterMood): string {
  if (name === 'sun' && mood === 'cheer') return assetUrl('/images/characters/sun-cheer.svg');
  if (name === 'moon' && mood === 'think') return assetUrl('/images/characters/moon-think.svg');
  return assetUrl(`/images/characters/${name}.svg`);
}

export const MEDAL_SRC: Record<MedalKind, string> = {
  gold: assetUrl('/images/ui/medal-gold.svg'),
  silver: assetUrl('/images/ui/medal-silver.svg'),
  bronze: assetUrl('/images/ui/medal-bronze.svg'),
};

export function medalForRank(rank: number): MedalKind | null {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null;
}

export const UI_IMAGES = {
  trophy: assetUrl('/images/ui/trophy.svg'),
  treasureClosed: assetUrl('/images/ui/treasure-closed.svg'),
  treasureOpen: assetUrl('/images/ui/treasure-open.svg'),
  star: assetUrl('/images/ui/star.svg'),
  cloud: assetUrl('/images/ui/cloud.svg'),
  rainbow: assetUrl('/images/ui/rainbow.svg'),
  logo: assetUrl('/images/ui/logo.svg'),
  emptyState: assetUrl('/images/ui/empty-state.svg'),
  favicon: assetUrl('/images/ui/favicon.svg'),
} as const;
