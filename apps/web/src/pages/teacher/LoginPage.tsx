import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LogIn } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherStore } from '@/stores/teacherStore';
import { friendlyError, teacherPath } from './labels';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const authStatus = useTeacherStore((s) => s.authStatus);
  const checkAuth = useTeacherStore((s) => s.checkAuth);
  const login = useTeacherStore((s) => s.login);
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authStatus === 'checking') void checkAuth();
  }, [authStatus, checkAuth]);

  if (authStatus === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    const target = from && from.startsWith(teacherPath()) && !from.endsWith('/login') ? from : teacherPath();
    return <Navigate to={target} replace />;
  }

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'יש להזין כתובת אימייל';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'כתובת האימייל אינה תקינה';
    if (!password) next.password = 'יש להזין סיסמה';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await login(email.trim(), password);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      setErrors({
        form:
          status === 401 || status === 400
            ? 'האימייל או הסיסמה שגויים. נסו שוב.'
            : friendlyError(err, 'ההתחברות נכשלה, נסו שוב'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-sky/20 via-slate-50 to-brand-violet/20 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/images/ui/logo.svg" alt="אלופי ההפכים" className="h-20 w-20 rounded-3xl shadow-md" />
          <div>
            <h1 className="text-3xl font-extrabold text-brand-navy">אלופי ההפכים</h1>
            <p className="mt-1 text-sm text-slate-500">כניסה לממשק המורה</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-xl shadow-brand-navy/5 ring-1 ring-slate-100 sm:p-8"
          aria-label="טופס התחברות"
        >
          <Input
            label="אימייל"
            type="email"
            name="email"
            autoComplete="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            placeholder="teacher@school.edu"
            required
          />
          <Input
            label="סיסמה"
            type="password"
            name="password"
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />
          {errors.form && (
            <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {errors.form}
            </div>
          )}
          <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={submitting}>
            <LogIn className="h-5 w-5" aria-hidden />
            התחברות
          </Button>
          <p className="text-center text-xs text-slate-400">הגישה מיועדת לצוות ההוראה בלבד. התלמידים מצטרפים עם קוד חדר.</p>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
