import type { AvatarId } from '@oc/shared';

export type CharacterName = 'sun' | 'moon';
export type CharacterMood = 'happy' | 'cheer' | 'think';
export type MedalKind = 'gold' | 'silver' | 'bronze';

export function avatarSrc(id: AvatarId): string {
  return `/avatars/${id}.svg`;
}

export function characterSrc(name: CharacterName, mood: CharacterMood): string {
  if (name === 'sun' && mood === 'cheer') return '/images/characters/sun-cheer.svg';
  if (name === 'moon' && mood === 'think') return '/images/characters/moon-think.svg';
  return `/images/characters/${name}.svg`;
}

export const MEDAL_SRC: Record<MedalKind, string> = {
  gold: '/images/ui/medal-gold.svg',
  silver: '/images/ui/medal-silver.svg',
  bronze: '/images/ui/medal-bronze.svg',
};

export function medalForRank(rank: number): MedalKind | null {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null;
}

export const UI_IMAGES = {
  trophy: '/images/ui/trophy.svg',
  treasureClosed: '/images/ui/treasure-closed.svg',
  treasureOpen: '/images/ui/treasure-open.svg',
  star: '/images/ui/star.svg',
  cloud: '/images/ui/cloud.svg',
  rainbow: '/images/ui/rainbow.svg',
  logo: '/images/ui/logo.svg',
  emptyState: '/images/ui/empty-state.svg',
  favicon: '/images/ui/favicon.svg',
} as const;
