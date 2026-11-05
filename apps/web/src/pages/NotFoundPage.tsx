import { Link } from 'react-router';
import { Home } from 'lucide-react';
import { Button, Card, Character, PageBackground } from '@/components/ui';

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-4">
      <PageBackground variant="sunset" rainbow={false} />
      <Card variant="glass" className="flex max-w-md flex-col items-center gap-4 text-center">
        <Character name="moon" mood="think" size="md" animate="wiggle" />
        <h1 className="text-3xl font-black">אופס! הדף הזה הלך לאיבוד</h1>
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
