/**
 * מקורות CORS ל־Socket.IO. אפשרויות ה־Gateway נקבעות בזמן טעינת המחלקה (decorator),
 * לכן נקראות ישירות מהסביבה – אותו מקור שממנו AppConfigService קורא CORS_ORIGINS.
 */
export function corsOriginsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] | boolean {
  const raw = env.CORS_ORIGINS ?? env.APP_URL ?? '';
  const origins = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (origins.length === 0) return env.NODE_ENV === 'production' ? false : true;
  return origins;
}
