/**
 * אתחול גרסת הדמו: מחליף את שכבת הרשת (fetch + socket) ב"שרת" שרץ בדפדפן.
 * נטען רק כשנבנה עם VITE_DEMO=1 – לא נכלל בבנייה הרגילה.
 */
import { setSocketFactory } from '@/services/socket';
import { setPlayerToken } from '@/lib/storage';
import { installMockFetch } from './mockFetch';
import { demoSocketFactory } from './mockSocket';

export function bootstrapDemo(): void {
  installMockFetch();
  setSocketFactory(demoSocketFactory);
  // מצב המשחק חי רק בזיכרון הדף – אסימון ישן מרענון קודם כבר לא תקף
  setPlayerToken(null);
  // בתוך דף מפורסם דיאלוגי הדפדפן (confirm) לא מוצגים ומחזירים false – מאשרים אוטומטית
  window.confirm = () => true;
}

export { DEMO_ROOMS, demoEngine } from './engine';
