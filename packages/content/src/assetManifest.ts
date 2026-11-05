import { AVATARS, AVATAR_LABELS } from '@oc/shared';
import { IMAGEABLE_PAIRS } from './wordPairs';

export type AssetKind = 'WORD_IMAGE' | 'AVATAR' | 'CHARACTER';

export interface AssetManifestEntry {
  key: string;
  kind: AssetKind;
  url: string;
  alt: string;
}

const pairAssets: AssetManifestEntry[] = IMAGEABLE_PAIRS.flatMap((pair) => [
  { key: `pair:${pair.id}:word`, kind: 'WORD_IMAGE', url: pair.wordImage ?? `/images/pairs/${pair.id}/word.svg`, alt: pair.word },
  { key: `pair:${pair.id}:opposite`, kind: 'WORD_IMAGE', url: pair.oppositeImage ?? `/images/pairs/${pair.id}/opposite.svg`, alt: pair.opposite },
]);

const avatarAssets: AssetManifestEntry[] = AVATARS.map((id) => ({
  key: `avatar:${id}`,
  kind: 'AVATAR',
  url: `/avatars/${id}.svg`,
  alt: AVATAR_LABELS[id],
}));

export const CHARACTER_ASSETS: AssetManifestEntry[] = [
  { key: 'character:sun', kind: 'CHARACTER', url: '/images/characters/sun.svg', alt: 'שמש שמחה' },
  { key: 'character:moon', kind: 'CHARACTER', url: '/images/characters/moon.svg', alt: 'ירח חייכן' },
];

/** כל נכסי התמונה שהלקוח צריך לטעון מראש: איורי זוגות, אווטארים ודמויות. */
export const ASSET_MANIFEST: Array<{ key: string; kind: AssetKind; url: string; alt: string }> = [
  ...pairAssets,
  ...avatarAssets,
  ...CHARACTER_ASSETS,
];

export function getAssetsByKind(kind: AssetKind): AssetManifestEntry[] {
  return ASSET_MANIFEST.filter((a) => a.kind === kind);
}
