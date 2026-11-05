import { GameMode, GameState } from '@oc/shared';

export const TEACHER_BASE = '/teacher';
export const teacherPath = (sub = ''): string => (sub ? `${TEACHER_BASE}/${sub.replace(/^\//, '')}` : TEACHER_BASE);

export type BadgeTone = 'gray' | 'sky' | 'green' | 'yellow' | 'violet' | 'pink' | 'orange' | 'navy';

export const TONE_CLASSES: Record<BadgeTone, string> = {
  gray: 'bg-slate-100 text-slate-600 ring-slate-200/80',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200/80',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  yellow: 'bg-amber-50 text-amber-700 ring-amber-200/80',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/80',
  pink: 'bg-pink-50 text-pink-700 ring-pink-200/80',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200/80',
  navy: 'bg-indigo-50 text-indigo-800 ring-indigo-200/80',
};

export const STATE_LABELS: Record<GameState, { label: string; tone: BadgeTone }> = {
  [GameState.CREATED]: { label: 'נוצר', tone: 'gray' },
  [GameState.WAITING_FOR_PLAYERS]: { label: 'ממתין לתלמידים', tone: 'sky' },
  [GameState.COUNTDOWN]: { label: 'ספירה לאחור', tone: 'yellow' },
  [GameState.QUESTION_ACTIVE]: { label: 'משחק פעיל', tone: 'green' },
  [GameState.QUESTION_RESULTS]: { label: 'תוצאות שאלה', tone: 'violet' },
  [GameState.NEXT_QUESTION]: { label: 'מעבר לשאלה הבאה', tone: 'violet' },
  [GameState.FINAL_RESULTS]: { label: 'תוצאות סופיות', tone: 'orange' },
  [GameState.COMPLETED]: { label: 'הסתיים', tone: 'navy' },
  [GameState.PAUSED]: { label: 'מושהה', tone: 'yellow' },
  [GameState.CANCELLED]: { label: 'בוטל', tone: 'gray' },
  [GameState.EXPIRED]: { label: 'פג תוקף', tone: 'gray' },
};

export const MODE_LABELS: Record<GameMode, { label: string; description: string }> = {
  [GameMode.SELF_PACED]: {
    label: 'קצב אישי',
    description: 'כל תלמיד מתקדם בקצב שלו. מתאים לתרגול עצמאי ולכיתות הטרוגניות.',
  },
  [GameMode.TEACHER_PACED]: {
    label: 'קצב המורה',
    description: 'כל הכיתה עונה על אותה שאלה יחד, והמורה מעבירה לשאלה הבאה. מתאים לדיון כיתתי.',
  },
};

export const ACTIVE_STATES: readonly GameState[] = [
  GameState.COUNTDOWN,
  GameState.QUESTION_ACTIVE,
  GameState.QUESTION_RESULTS,
  GameState.NEXT_QUESTION,
  GameState.PAUSED,
];

export const ENDED_STATES: readonly GameState[] = [GameState.COMPLETED, GameState.CANCELLED, GameState.EXPIRED];

const dateTimeFormat = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short' });
const dateFormat = new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' });
const numberFormat = new Intl.NumberFormat('he-IL');

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateTimeFormat.format(d);
}

export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : dateFormat.format(d);
}

export function formatNumber(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? numberFormat.format(n) : '—';
}

export function formatPercent(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? `${Math.round(n)}%` : '—';
}

export function timeLabel(sec: number): string {
  return sec === 0 ? 'ללא הגבלה' : `${sec} שניות`;
}

/** הודעת שגיאה ידידותית בעברית מתוך שגיאת API. */
export function friendlyError(err: unknown, fallback = 'משהו השתבש, נסו שוב בעוד רגע'): string {
  const status =
    err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number'
      ? (err as { status: number }).status
      : undefined;
  const message =
    err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : '';
  if (status === 401) return 'ההתחברות פגה – יש להתחבר מחדש';
  if (status === 403) return message || 'אין הרשאה לבצע פעולה זו';
  if (status === 404) return message || 'הפריט לא נמצא';
  if (status === 409) return message || 'הפעולה מתנגשת עם המצב הנוכחי';
  if (status === 429) return 'יותר מדי ניסיונות – נסו שוב בעוד דקה';
  if (status !== undefined && status >= 500) return 'תקלה בשרת, נסו שוב בעוד רגע';
  if (status === undefined && (!message || /fetch|network/i.test(message))) return 'אין חיבור לשרת – בדקו את הרשת';
  return message || fallback;
}
