import { MAX_DISPLAY_NAME, MIN_DISPLAY_NAME } from './constants';

const BLOCKED_WORDS = [
  'טיפש', 'מטומטם', 'דביל', 'אידיוט', 'מפגר', 'זונה', 'שרמוטה', 'כלבה', 'חרא', 'זין',
  'מניאק', 'בן זונה', 'fuck', 'shit', 'bitch', 'ass', 'damn', 'idiot', 'stupid', 'sex',
];

const ALLOWED_RE = /^[֐-׿a-zA-Z0-9 \-'’"״׳.]+$/u;

export interface NameValidation {
  ok: boolean;
  normalized: string;
  reason?: string;
}

/** מנקה ומאמת שם תצוגה של תלמיד */
export function validateDisplayName(raw: string): NameValidation {
  const normalized = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (normalized.length < MIN_DISPLAY_NAME) return { ok: false, normalized, reason: 'השם קצר מדי' };
  if (normalized.length > MAX_DISPLAY_NAME) return { ok: false, normalized, reason: 'השם ארוך מדי' };
  if (!ALLOWED_RE.test(normalized)) return { ok: false, normalized, reason: 'השם מכיל תווים לא מותרים' };
  const lowered = normalized.toLowerCase().replace(/[\s\-'’"״׳.]/g, '');
  for (const word of BLOCKED_WORDS) {
    if (lowered.includes(word.replace(/\s/g, '').toLowerCase())) {
      return { ok: false, normalized, reason: 'בחרו שם אחר בבקשה' };
    }
  }
  return { ok: true, normalized };
}

/** מפתח השוואה לשמות כפולים בחדר (ללא רווחים/גרשים, אותיות קטנות) */
export function nameKey(name: string): string {
  return name.normalize('NFC').toLowerCase().replace(/[\s\-'’"״׳.]/g, '');
}
