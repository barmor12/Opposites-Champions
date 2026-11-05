import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import { LogIn, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useTeacherStore } from '@/stores/teacherStore';
import { friendlyError, teacherPath } from './labels';
import { FloatingBlobs } from './components';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginPage() {
  const authStatus = useTeacherStore((s) => s.authStatus);
  const checkAuth = useTeacherStore((s) => s.checkAuth);
  const login = useTeacherStore((s) => s.login);
  const location = useLocation();
  const reduce = useReducedMotion();

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
        form: status === 401 || status === 400 ? 'האימייל או הסיסמה שגויים. נסו שוב.' : friendlyError(err, 'ההתחברות נכשלה, נסו שוב'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <FloatingBlobs />
      <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
        {/* צד שמאל – ברכה */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="hidden flex-col items-start gap-6 lg:flex"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-linear-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-[0_10px_24px_-10px_rgba(139,92,246,.9)] ring-1 ring-white/60">
              <img src="/images/ui/logo.svg" alt="" className="size-9" />
            </span>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-brand-violet">ממשק המורה</span>
          </div>
          <h1 className="text-4xl font-black leading-[1.15] tracking-tight text-brand-navy xl:text-5xl">
            אלופי ההפכים
            <span className="mt-2 block bg-linear-to-l from-violet-600 to-sky-500 bg-clip-text text-2xl font-extrabold text-transparent xl:text-3xl">משחק כיתתי בלחיצה אחת</span>
          </h1>
          <p className="max-w-md text-base leading-7 text-slate-600">יוצרים חדר, מציגים את הקוד על הלוב, והכיתה משחקת מהטאבלטים. עוקבים אחרי ההתקדמות בזמן אמת ומקבלים תוצאות מפורטות בסוף.</p>
          <ul className="grid gap-2 text-sm text-slate-600">
            {['קוד חדר ו־QR להצטרפות מיידית', 'מעקב חי אחרי כל תלמיד', 'דוחות ויצוא ל־Excel'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
          <motion.img
            src="/images/characters/sun.svg"
            alt=""
            className="pointer-events-none absolute -bottom-10 left-6 hidden w-44 opacity-90 drop-shadow-xl xl:block"
            animate={reduce ? undefined : { y: [0, -12, 0], rotate: [0, 3, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* כרטיס התחברות */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.05 }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="pointer-events-none absolute -inset-1 rounded-[2rem] bg-linear-to-br from-violet-400/40 via-sky-300/30 to-pink-300/40 blur-xl" aria-hidden />
          <div className="relative rounded-[1.75rem] bg-white/85 p-6 shadow-[0_30px_60px_-30px_rgba(30,41,59,.45),0_2px_6px_-2px_rgba(30,41,59,.1)] ring-1 ring-white/80 backdrop-blur-xl sm:p-8">
            <div className="mb-6 flex flex-col items-center gap-3 text-center lg:items-start lg:text-start">
              <img src="/images/ui/logo.svg" alt="אלופי ההפכים" className="size-16 drop-shadow-md lg:hidden" />
              <div>
                <h2 className="text-2xl font-black tracking-tight text-brand-navy">ברוכים השבים</h2>
                <p className="mt-1 text-sm text-slate-500">התחברו כדי לנהל משחקים ולצפות בתוצאות הכיתה.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4" aria-label="טופס התחברות">
              <Input
                label="אימייל"
                type="email"
                name="email"
                size="md"
                autoComplete="email"
                dir="ltr"
                icon={<Mail className="size-5" aria-hidden />}
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
                size="md"
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                required
              />
              {errors.form && (
                <div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
                  {errors.form}
                </div>
              )}
              <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting} disabled={submitting} className="mt-1">
                <LogIn className="size-5" aria-hidden />
                התחברות
              </Button>
              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                <ShieldCheck className="size-3.5" aria-hidden />
                הגישה מיועדת לצוות ההוראה בלבד. התלמידים מצטרפים עם קוד חדר.
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default LoginPage;
