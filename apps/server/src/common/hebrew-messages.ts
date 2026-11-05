/** Common Hebrew user-facing messages (keep short and friendly). */
export const HE = {
  badRequest: 'הבקשה אינה תקינה',
  validationFailed: 'חלק מהנתונים שנשלחו אינם תקינים',
  unauthorized: 'נדרשת התחברות',
  teacherLoginRequired: 'נדרשת התחברות מורה',
  sessionExpired: 'ההתחברות פגה, יש להתחבר מחדש',
  invalidCredentials: 'אימייל או סיסמה שגויים',
  forbidden: 'אין הרשאה לבצע פעולה זו',
  csrf: 'בקשה לא חוקית',
  notFound: 'הפריט המבוקש לא נמצא',
  routeNotFound: 'הנתיב המבוקש לא קיים',
  conflict: 'הפעולה מתנגשת עם נתונים קיימים',
  tooManyRequests: 'יותר מדי בקשות, נסו שוב בעוד רגע',
  internal: 'אירעה שגיאה, נסו שוב מאוחר יותר',
  serviceUnavailable: 'השירות אינו זמין כרגע',
  wordPairNotFound: 'זוג המילים לא נמצא',
  wordPairSlugExists: 'מזהה (slug) זה כבר קיים במאגר',
  mediaNotFound: 'קובץ המדיה לא נמצא',
  unknownField: (field: string): string => `שדה לא מוכר: ${field}`,
} as const;

/** Default Hebrew message per HTTP status code. */
export function hebrewMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return HE.badRequest;
    case 401:
      return HE.unauthorized;
    case 403:
      return HE.forbidden;
    case 404:
      return HE.notFound;
    case 409:
      return HE.conflict;
    case 429:
      return HE.tooManyRequests;
    case 503:
      return HE.serviceUnavailable;
    default:
      return status >= 500 ? HE.internal : HE.badRequest;
  }
}

/** English defaults emitted by Nest/throttler that should be replaced with Hebrew. */
const ENGLISH_DEFAULTS = new Set([
  'Bad Request',
  'Unauthorized',
  'Forbidden',
  'Not Found',
  'Conflict',
  'Too Many Requests',
  'ThrottlerException: Too Many Requests',
  'Internal Server Error',
  'Service Unavailable',
  'Unprocessable Entity',
  'Payload Too Large',
]);

export function isEnglishDefaultMessage(message: string): boolean {
  return ENGLISH_DEFAULTS.has(message);
}
