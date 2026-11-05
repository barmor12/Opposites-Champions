import { lazy, Suspense, useEffect } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { demoEngine } from './engine';

const App = lazy(() => import('@/App'));

/** "המורה פותחת סבב חדש" כשחוזרים מהתוצאות לחדר ההמתנה */
function RoundWatcher() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname === '/play') demoEngine.newRound();
  }, [pathname]);
  return null;
}

/** שורש גרסת הדמו – ניתוב בזיכרון (הדף המפורסם לא יכול להשתמש בנתיבי URL) */
export function DemoRoot() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <RoundWatcher />
      <Suspense fallback={null}>
        <App />
      </Suspense>
    </MemoryRouter>
  );
}
