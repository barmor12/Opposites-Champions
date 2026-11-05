/** סימני ניקוד, טעמים ומתגים (U+0591–U+05C7, למעט מקף ־ U+05BE שהוא חלק מהמילה) */
export const NIKUD_RE = /[֑-ֽֿ-ׇ]/g;

/** מסיר ניקוד/טעמים – להשוואות, חיפוש ומפתחות (לא לתצוגה) */
export function stripNikud(text: string): string {
  return text.replace(NIKUD_RE, '');
}

/** האם הטקסט מכיל ניקוד */
export function hasNikud(text: string): boolean {
  return /[֑-ֽֿ-ׇ]/.test(text);
}

/**
 * ביטוי רגולרי שמתאים לטקסט עברי בין אם הוא מנוקד ובין אם לא
 * (שימושי בבדיקות: `getByText(nikudInsensitive('גדול'))`).
 */
export function nikudInsensitive(plain: string): RegExp {
  const esc = stripNikud(plain).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(esc.split('').map((ch) => `${ch}[\\u0591-\\u05BD\\u05BF-\\u05C7]*`).join(''));
}
