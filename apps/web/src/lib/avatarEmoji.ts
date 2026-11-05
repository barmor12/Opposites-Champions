import type { AvatarId } from '@oc/shared';

/** אימוג׳י גיבוי לכל דמות – מוצג כשקובץ ה־SVG עדיין לא נטען/לא קיים */
export const AVATAR_EMOJI: Record<AvatarId, string> = {
  lion: '🦁', fox: '🦊', owl: '🦉', panda: '🐼', frog: '🐸', cat: '🐱', dog: '🐶', rabbit: '🐰',
  koala: '🐨', penguin: '🐧', monkey: '🐵', elephant: '🐘', unicorn: '🦄', dino: '🦖', bee: '🐝', turtle: '🐢',
};

/** צבע רקע עדין לכל דמות (לגיבוי ולטבעת) */
export const AVATAR_TINT: Record<AvatarId, string> = {
  lion: '#fde68a', fox: '#fdba74', owl: '#c4b5fd', panda: '#e2e8f0', frog: '#bbf7d0', cat: '#fbcfe8',
  dog: '#fed7aa', rabbit: '#fce7f3', koala: '#e9d5ff', penguin: '#bae6fd', monkey: '#fef3c7', elephant: '#cbd5e1',
  unicorn: '#f5d0fe', dino: '#bbf7d0', bee: '#fef08a', turtle: '#a7f3d0',
};
