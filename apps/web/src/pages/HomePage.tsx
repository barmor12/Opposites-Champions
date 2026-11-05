import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { GraduationCap, Hash, Rocket, User, Play } from 'lucide-react';
import { ROOM_CODE_LENGTH, MAX_DISPLAY_NAME, validateDisplayName, type AvatarId } from '@oc/shared';
import { AvatarPicker, Button, Card, Character, Input, PageBackground, SoundToggle, toast } from '@/components/ui';
import { FloatingStars } from '@/animations';
import { useSound } from '@/hooks/useSound';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { errorMessage } from '@/services/api';

const GREETING_MS = 1700;

interface FormErrors {
  displayName?: string;
  code?: string;
  avatar?: string;
}

export function HomePage() {
  const navigate = useNavigate();
  const params = useParams<{ code?: string }>();
  const reduce = useReducedMotion();
  const { play } = useSound();

  const draft = useUiStore((s) => s.joinDraft);
  const setDraft = useUiStore((s) => s.setJoinDraft);
  const join = usePlayerStore((s) => s.join);
  const status = usePlayerStore((s) => s.status);
  const token = usePlayerStore((s) => s.token);
  const removedReason = usePlayerStore((s) => s.removedReason);
  const clearRemoved = usePlayerStore((s) => s.clearRemoved);
  const restoreSession = usePlayerStore((s) => s.restoreSession);
  const existingName = usePlayerStore((s) => s.displayName);

  const [displayName, setDisplayName] = useState(draft.displayName);
  const [code, setCode] = useState(() => sanitizeCode(params.code ?? draft.code));
  const [avatar, setAvatar] = useState<AvatarId | null>(draft.avatar);
  const [errors, setErrors] = useState<FormErrors>({});
  const [greeting, setGreeting] = useState<string | null>(null);
  const [resumable, setResumable] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // קוד מה־URL (/join/:code)
  useEffect(() => {
    if (params.code) setCode(sanitizeCode(params.code));
  }, [params.code]);

  // הודעת הסרה ע"י המורה
  useEffect(() => {
    if (removedReason) {
      toast.error(removedReason);
      clearRemoved();
    }
  }, [removedReason, clearRemoved]);

  // משחק פעיל קיים? מציעים להמשיך
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    restoreSession().then((s) => {
      if (!cancelled && s) setResumable(true);
    });
    return () => {
      cancelled = true;
    };
  }, [token, restoreSession]);

  const submitting = status === 'joining';

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    const name = validateDisplayName(displayName);
    if (!displayName.trim()) nextErrors.displayName = 'איך קוראים לך? כתבו שם';
    else if (!name.ok) nextErrors.displayName = name.reason ?? 'השם לא תקין';
    const cleanCode = sanitizeCode(code);
    if (!cleanCode) nextErrors.code = 'כתבו את קוד המשחק שהמורה נתנה';
    else if (cleanCode.length !== ROOM_CODE_LENGTH) nextErrors.code = `הקוד צריך להיות ${ROOM_CODE_LENGTH} ספרות`;
    if (!avatar) nextErrors.avatar = 'בחרו דמות שתייצג אתכם במשחק';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.displayName) nameRef.current?.focus();
      return;
    }

    try {
      const res = await join({ code: cleanCode, displayName: name.normalized, avatar: avatar! });
      setDraft({ displayName: name.normalized, avatar, code: '' });
      play('join');
      setGreeting(res.displayName);
      window.setTimeout(() => navigate('/play', { replace: true }), reduce ? 400 : GREETING_MS);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <main className="relative flex min-h-dvh flex-col items-center px-4 pb-10 pt-4 sm:pt-6">
      <PageBackground variant="day" rainbow />
      <FloatingStars count={reduce ? 0 : 10} />

      <div className="flex w-full max-w-5xl items-center justify-between">
        <Link
          to="/teacher"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white/70 px-4 text-sm font-bold text-slate-600 backdrop-blur hover:bg-white"
        >
          <GraduationCap className="size-5" aria-hidden /> כניסת מורה
        </Link>
        <SoundToggle />
      </div>

      <section className="mt-4 flex w-full max-w-5xl flex-col items-center gap-6 lg:mt-10 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        {/* Hero */}
        <div className="flex w-full flex-col items-center text-center lg:sticky lg:top-8 lg:w-1/2 lg:pt-6">
          <div className="flex w-full items-end justify-center gap-2 sm:gap-6">
            <Character name="sun" mood="cheer" size="md" delay={0.2} />
            <motion.h1
              initial={reduce ? false : { y: -30, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="text-shadow-pop text-4xl font-black leading-tight text-brand-navy sm:text-6xl lg:text-7xl"
            >
              <span aria-hidden>🌈 </span>
              אלופי
              <br className="sm:hidden" /> ההפכים
              <span aria-hidden> 🏆</span>
            </motion.h1>
            <Character name="moon" mood="happy" size="md" animate="bounce" delay={0.6} />
          </div>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-3 max-w-md text-xl font-bold text-violet-800 sm:text-2xl"
          >
            מי יהיה אלוף ההפכים של הכיתה?
          </motion.p>
          <ul className="mt-4 flex flex-wrap justify-center gap-2 text-sm font-bold text-slate-700" aria-label="מה במשחק">
            {['גדול ↔ קטן', 'חם ↔ קר', 'יום ↔ לילה', 'מהר ↔ לאט'].map((t, i) => (
              <motion.li
                key={t}
                initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 300 }}
                className="rounded-full bg-white/80 px-3 py-1.5 shadow-sm"
              >
                {t}
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Join form */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.15 }}
          className="w-full max-w-lg lg:w-1/2"
        >
          <Card variant="glass" className="flex flex-col gap-5">
            {resumable && (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-green-50 p-4 text-center ring-2 ring-green-200 sm:flex-row sm:text-start">
                <p className="flex-1 font-bold text-green-800">
                  יש לך משחק פעיל{existingName ? ` בשם ${existingName}` : ''}. רוצה להמשיך?
                </p>
                <Button variant="success" size="md" icon={<Play className="size-5" />} onClick={() => navigate('/play')}>
                  להמשיך
                </Button>
              </div>
            )}
            <h2 className="text-center text-2xl font-black">הצטרפו למשחק</h2>
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
              <Input
                ref={nameRef}
                label="מה השם שלך?"
                placeholder="לדוגמה: נועה"
                value={displayName}
                maxLength={MAX_DISPLAY_NAME}
                autoComplete="nickname"
                icon={<User className="size-6" />}
                error={errors.displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.displayName) setErrors((p) => ({ ...p, displayName: undefined }));
                }}
              />
              <Input
                label="קוד המשחק"
                placeholder="● ● ● ● ● ●"
                value={code}
                dir="ltr"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={ROOM_CODE_LENGTH}
                size="xl"
                icon={<Hash className="size-6" />}
                className="text-center font-black tracking-[0.5em] tabular-nums"
                hint={`${ROOM_CODE_LENGTH} ספרות שהמורה מציגה על הלוח`}
                error={errors.code}
                onChange={(e) => {
                  setCode(sanitizeCode(e.target.value));
                  if (errors.code) setErrors((p) => ({ ...p, code: undefined }));
                }}
              />
              <AvatarPicker
                value={avatar}
                onChange={(id) => {
                  setAvatar(id);
                  play('click');
                  if (errors.avatar) setErrors((p) => ({ ...p, avatar: undefined }));
                }}
                error={errors.avatar}
              />
              <Button type="submit" size="xl" fullWidth loading={submitting} icon={<Rocket className="size-7" />}>
                בואו נשחק!
              </Button>
            </form>
          </Card>
        </motion.div>
      </section>

      <AnimatePresence>
        {greeting && <Greeting name={greeting} />}
      </AnimatePresence>
    </main>
  );
}

function Greeting({ name }: { name: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="status"
      aria-live="assertive"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-brand-sky/95 to-brand-violet/95 p-6 text-center text-white"
    >
      <motion.div
        initial={reduce ? false : { scale: 0.5, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="flex flex-col items-center gap-4"
      >
        <Character name="sun" mood="cheer" size="lg" animate="bounce" />
        <h2 className="text-4xl font-black sm:text-5xl">שלום {name}!</h2>
        <p className="text-2xl font-bold sm:text-3xl">איזה כיף שהצטרפת! 🎉</p>
      </motion.div>
    </motion.div>
  );
}

function sanitizeCode(v: string | undefined): string {
  return (v ?? '').replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH);
}

export default HomePage;
