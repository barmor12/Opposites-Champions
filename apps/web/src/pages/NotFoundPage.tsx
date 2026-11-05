import { Link } from 'react-router';
import { Home } from 'lucide-react';
import { Button, Card, Character, PageBackground } from '@/components/ui';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip items-center justify-center safe-x safe-bottom p-4">
      <PageBackground variant="sunset" rainbow={false} />
      <Card variant="glass" className="flex w-full max-w-md flex-col items-center gap-4 text-center shadow-float">
        <Character name="moon" mood="think" size="md" animate="wiggle" />
        <p className="text-fluid-hero font-black leading-none text-gradient-candy" aria-hidden>404</p>
        <h1 className="text-2xl font-black sm:text-3xl">אופס! הדף הזה הלך לאיבוד</h1>
        <p className="text-lg text-slate-600">
          כמו ההפך של "נמצא"… הדף שחיפשתם לא קיים. בואו נחזור למשחק!
        </p>
        <Link to="/" className="w-full">
          <Button fullWidth size="xl" icon={<Home className="size-6" />} tabIndex={-1}>
            חזרה לדף הבית
          </Button>
        </Link>
      </Card>
    </main>
  );
}

export default NotFoundPage;
