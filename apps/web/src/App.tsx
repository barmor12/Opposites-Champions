import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Route, Routes } from 'react-router';
import { Button, Card, Character, PageBackground, Spinner, Toaster } from '@/components/ui';
import { HomePage } from '@/pages/HomePage';
import { PlayPage } from '@/pages/PlayPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const TeacherRoutes = lazy(() => import('@/pages/teacher').then((m) => ({ default: m.TeacherRoutes })));
// עמוד דמו למשחקים – בפיתוח בלבד
const GamesDemo = import.meta.env.DEV ? lazy(() => import('@/games/demo/GamesDemo').then((m) => ({ default: m.GamesDemo }))) : null;

function PageFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <PageBackground rainbow={false} />
      <Spinner size="lg" className="text-brand-violet" />
    </div>
  );
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="flex min-h-dvh items-center justify-center p-4">
        <PageBackground variant="sunset" rainbow={false} />
        <Card variant="glass" className="flex max-w-md flex-col items-center gap-4 text-center">
          <Character name="moon" mood="think" size="md" animate="wiggle" />
          <h1 className="text-2xl font-black">אופס! משהו השתבש</h1>
          <p className="text-slate-600">נסו לרענן את הדף. אם זה חוזר, ספרו למורה.</p>
          <Button onClick={() => window.location.reload()}>רענון</Button>
        </Card>
      </main>
    );
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/join/:code" element={<HomePage />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route
          path="/teacher/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <TeacherRoutes />
            </Suspense>
          }
        />
        {GamesDemo && (
          <Route
            path="/dev/games"
            element={
              <Suspense fallback={<PageFallback />}>
                <GamesDemo />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Toaster />
    </AppErrorBoundary>
  );
}
