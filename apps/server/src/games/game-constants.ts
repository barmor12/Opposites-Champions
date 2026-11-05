import { COUNTDOWN_SECONDS } from '@oc/shared';

/** חסד (ms) אחרי תום הזמן שבו תשובה עדיין נרשמת כתקפה (פיצוי על השהיית רשת) */
export const ANSWER_GRACE_MS = 1500;
export const COUNTDOWN_MS = COUNTDOWN_SECONDS * 1000;

/** חדר פג תוקף 24 שעות אחרי יצירתו (או אחרי פתיחת סבב חדש) – נאכף בגישה ובסריקה תקופתית */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** תדירות הסריקה התקופתית של חדרים שפג תוקפם */
export const ROOM_EXPIRY_SWEEP_MS = 10 * 60 * 1000;
