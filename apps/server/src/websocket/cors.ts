/**
 * מקורות CORS ל־Socket.IO. אפשרויות ה־Gateway נקבעות בזמן טעינת המחלקה (decorator),
 * לכן נקראות ישירות מהסביבה – אותו מקור שממנו AppConfigService קורא CORS_ORIGINS.
 * בפרודקשן ללא CORS_ORIGINS → אין מקור מותר (false). בפיתוח → ברירת המחדל של Vite בלבד (לעולם לא `*`).
 */
export const DEV_SOCKET_ORIGINS = ['http://localhost:5173'];

export function corsOriginsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] | false {
  const raw = env.CORS_ORIGINS ?? env.APP_URL ?? '';
  const origins = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (origins.length === 0) return env.NODE_ENV === 'production' ? false : [...DEV_SOCKET_ORIGINS];
  return origins;
}
