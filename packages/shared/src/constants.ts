export const ROOM_CODE_LENGTH = 6;
export const MAX_PLAYERS_PER_ROOM = 60;
export const MIN_DISPLAY_NAME = 2;
export const MAX_DISPLAY_NAME = 20;
export const BASE_SCORE = 100;
export const MAX_SPEED_BONUS = 50;
export const COUNTDOWN_SECONDS = 3;
export const RESULTS_DISPLAY_MS = 4000;
export const TREASURE_QUESTIONS = 5;
export const TREASURE_BONUS = 150;
export const MATCH_PAIRS_PER_QUESTION = 4;
export const MATCH_PAIRS_BASE_SCORE = 100;
export const MATCH_PAIRS_PERFECT_BONUS = 50;
export const QUESTION_COUNT_OPTIONS = [10, 12, 15, 20] as const;
export const TIME_PER_QUESTION_OPTIONS = [15, 20, 30, 0] as const; // 0 = ללא הגבלה
export const SESSION_TOKEN_HEADER = 'x-player-token';

export const AVATARS = [
  'lion', 'fox', 'owl', 'panda', 'frog', 'cat', 'dog', 'rabbit',
  'koala', 'penguin', 'monkey', 'elephant', 'unicorn', 'dino', 'bee', 'turtle',
] as const;
export type AvatarId = (typeof AVATARS)[number];
export const AVATAR_LABELS: Record<AvatarId, string> = {
  lion: 'אַרְיֵה', fox: 'שׁוּעָל', owl: 'יַנְשׁוּף', panda: 'פַּנְדָּה', frog: 'צְפַרְדֵּעַ', cat: 'חָתוּל', dog: 'כֶּלֶב',
  rabbit: 'אַרְנָב', koala: 'קוֹאָלָה', penguin: 'פִּינְגְּוִוין', monkey: 'קוֹף', elephant: 'פִּיל',
  unicorn: 'חַד־קֶרֶן', dino: 'דִּינוֹזָאוּר', bee: 'דְּבוֹרָה', turtle: 'צָב',
};
