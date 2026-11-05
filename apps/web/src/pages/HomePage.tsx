import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { GraduationCap, Hash, Rocket, User, Play, Sparkles } from 'lucide-react';
import { ROOM_CODE_LENGTH, MAX_DISPLAY_NAME, validateDisplayName, type AvatarId } from '@oc/shared';
import { AvatarPicker, Button, Card, Character, Input, PageBackground, SoundToggle, toast } from '@/components/ui';
import { FloatingStars } from '@/animations';
import { useSound } from '@/hooks/useSound';
import { usePlayerStore } from '@/stores/playerStore';
import { useUiStore } from '@/stores/uiStore';
import { errorMessage } from '@/services/api';
import { cn } from '@/lib/cn';

const GREETING_MS = 1700;

interface FormErrors {
  displayName?: string;
  code?: string;
  avatar?: string;
}

const CHIPS = [
  { t: 'גדול ↔ קטן', c: 'from-sky-100 to-sky-200 text-sky-900 border-sky-300' },
  { t: 'חם ↔ קר', c: 'from-orange-100 to-orange-200 text-orange-900 border-orange-300' },
  { t: 'יום ↔ לילה', c: 'from-violet-100 to-violet-200 text-violet-900 border-violet-300' },
  { t: 'מהר ↔ לאט', c: 'from-green-100 to-green-200 text-green-900 border-green-300' },
];

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

  // קוד מה־URL (/join/:code) – מתעדכן אם הפרמטר משתנה
  const [prevParamCode, setPrevParamCode] = useState(params.code);
  if (params.code !== prevParamCode) {
    setPrevParamCode(params.code);
    if (params.code) setCode(sanitizeCode(params.code));
  }

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
    <main className="relative flex min-h-dvh flex-col items-center safe-x safe-bottom pt-3 sm:pt-5">
      <PageBackground variant="day" rainbow />
      <FloatingStars count={reduce ? 0 : 10} />

      {/* סרגל עליון */}
      <div className="flex w-full max-w-6xl items-center justify-between gap-2">
        <Link
          to="/teacher"
          className="inline-flex min-h-12 items-center gap-2 rounded-full glass px-4 text-sm font-bold text-slate-600 transition-transform hover:-translate-y-0.5"
        >
          <GraduationCap className="size-5" aria-hidden /> כניסת מורה
        </Link>
        <SoundToggle />
      </div>

      <section className="mt-3 grid w-full max-w-6xl flex-1 grid-cols-1 items-start gap-6 sm:mt-6 lg:mt-8 lg:grid-cols-[1.05fr_minmax(0,34rem)] lg:gap-10 xl:gap-14">
        {/* Hero */}
        <div className="flex w-full flex-col items-center text-center lg:sticky lg:top-8 lg:pt-4">
          <GameLogo />
          <div className="relative mt-3 flex w-full max-w-2xl items-center justify-center gap-2 sm:mt-5 sm:gap-6">
            <HeroCharacter name="sun" mood="cheer" delay={0.2} />
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="max-w-[11rem] text-[1.2rem] font-black leading-snug text-violet-800 text-shadow-pop sm:max-w-xs sm:text-2xl lg:max-w-sm lg:text-3xl"
            >
              מי יהיה אלוף ההפכים של הכיתה?
            </motion.p>
            <HeroCharacter name="moon" mood="happy" animate="bounce" delay={0.6} />
          </div>
          <ul className="mt-4 flex flex-wrap justify-center gap-2 sm:mt-6 sm:gap-3" aria-label="מה במשחק">
            {CHIPS.map((chip, i) => (
              <motion.li
                key={chip.t}
                initial={reduce ? false : { opacity: 0, scale: 0.6, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 300, damping: 18 }}
                className={cn(
                  'rounded-full border-b-[3px] bg-gradient-to-b px-3.5 py-1.5 text-sm font-black sm:px-4 sm:text-base',
                  'shadow-[0_6px_14px_-6px_rgba(30,41,59,0.35),inset_0_1px_0_rgba(255,255,255,0.8)]',
                  chip.c,
                )}
              >
                {chip.t}
              </motion.li>
            ))}
          </ul>
        </div>

        {/* Join form */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.15 }}
          className="mx-auto w-full max-w-xl lg:mx-0 lg:max-w-none"
        >
          <Card variant="glass" spotlight className="flex flex-col gap-5 shadow-float">
            {resumable && (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-gradient-to-b from-green-50 to-emerald-100/80 p-4 text-center ring-2 ring-green-300/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:flex-row sm:text-start">
                <p className="flex-1 font-bold text-green-800">
                  יש לך משחק פעיל{existingName ? ` בשם ${existingName}` : ''}. רוצה להמשיך?
                </p>
                <Button variant="success" size="md" icon={<Play className="size-5" />} onClick={() => navigate('/play')}>
                  להמשיך
                </Button>
              </div>
            )}
            <h2 className="flex items-center justify-center gap-2 text-center text-2xl font-black sm:text-3xl">
              <Sparkles className="size-6 text-brand-violet" aria-hidden />
              הצטרפו למשחק
            </h2>
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
                className="text-center font-black tracking-[0.45em] tabular-nums"
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
              <Button type="submit" size="xl" fullWidth glow loading={submitting} icon={<Rocket className="size-7" />}>
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

/** לוגו המשחק – טיפוגרפיית משחק: מילוי גרדיאנט, קו־מתאר לבן רך וצל עומק */
function GameLogo() {
  const reduce = useReducedMotion();
  const text = 'אלופי ההפכים';
  return (
    <motion.h1
      initial={reduce ? false : { y: -30, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className="relative isolate inline-grid place-items-center whitespace-nowrap px-3 py-2 text-fluid-hero font-black leading-[1.05] tracking-tight"
    >
      <span aria-hidden className="pointer-events-none absolute -top-2 start-2 text-[0.55em] animate-sparkle">✨</span>
      <span aria-hidden className="pointer-events-none absolute -bottom-1 end-1 text-[0.45em] animate-sparkle" style={{ animationDelay: '0.9s' }}>✨</span>
      {/* שכבת קו־מתאר + צל (מאחור) */}
      <span
        aria-hidden
        className="col-start-1 row-start-1 text-transparent [paint-order:stroke_fill] [-webkit-text-stroke:0.22em_white] drop-shadow-[0_6px_0_rgba(109,40,217,0.35)]"
        style={{ filter: 'drop-shadow(0 6px 0 rgb(109 40 217 / 0.35)) drop-shadow(0 16px 24px rgb(30 41 59 / 0.3))' }}
      >
        {text}
      </span>
      {/* שכבת גרדיאנט (מלפנים) */}
      <span className="col-start-1 row-start-1 text-gradient-brand">{text}</span>
    </motion.h1>
  );
}

function HeroCharacter({ name, mood, animate, delay }: { name: 'sun' | 'moon'; mood: 'cheer' | 'happy'; animate?: 'float' | 'bounce'; delay: number }) {
  return (
    <div className="relative shrink-0">
      <span aria-hidden className={cn('absolute inset-[10%] -z-10 rounded-full blur-2xl', name === 'sun' ? 'bg-yellow-300/70' : 'bg-indigo-300/60')} />
      <span aria-hidden className="pointer-events-none absolute -top-1 start-0 text-lg animate-sparkle sm:text-2xl" style={{ animationDelay: `${delay + 0.4}s` }}>✦</span>
      <span aria-hidden className="pointer-events-none absolute bottom-2 -end-1 text-sm animate-sparkle text-white sm:text-xl" style={{ animationDelay: `${delay + 1.1}s` }}>✦</span>
      <Character name={name} mood={mood} animate={animate ?? 'float'} delay={delay} size="none" className="size-[4.6rem] sm:size-32 lg:size-40 xl:size-48" />
    </div>
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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-b from-sky-400 via-brand-violet to-indigo-700 p-6 text-center text-white"
    >
      <div
        aria-hidden
        className={cn('absolute left-1/2 top-1/2 aspect-square w-[160vmax] -translate-x-1/2 -translate-y-1/2 opacity-30', !reduce && 'animate-rays')}
        style={{ backgroundImage: 'repeating-conic-gradient(from 0deg, rgb(255 255 255 / 0.5) 0deg 8deg, transparent 8deg 24deg)' }}
      />
      <motion.div
        initial={reduce ? false : { scale: 0.5, y: 40, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="relative flex flex-col items-center gap-4"
      >
        <Character name="sun" mood="cheer" size="lg" animate="bounce" />
        <h2 className="text-fluid-hero font-black text-extrude">שלום {name}!</h2>
        <p className="text-2xl font-bold text-shadow-soft sm:text-3xl">איזה כיף שהצטרפת! 🎉</p>
      </motion.div>
    </motion.div>
  );
}

function sanitizeCode(v: string | undefined): string {
  return (v ?? '').replace(/\D/g, '').slice(0, ROOM_CODE_LENGTH);
}

export default HomePage;
