import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BookOpenText, ChevronLeft, LayoutDashboard, LogOut, Menu, PlusCircle, Sparkles, X, type LucideIcon } from 'lucide-react';
import { Spinner, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useTeacherStore } from '@/stores/teacherStore';
import { teacherPath } from './labels';
import { FloatingBlobs, TeacherChromeContext, type Crumb } from './components';

const NAV: ReadonlyArray<{ to: string; label: string; short: string; icon: LucideIcon; end: boolean }> = [
  { to: teacherPath(), label: 'לוח בקרה', short: 'לוח', icon: LayoutDashboard, end: true },
  { to: teacherPath('new'), label: 'משחק חדש', short: 'חדש', icon: PlusCircle, end: false },
  { to: teacherPath('content'), label: 'מאגר ההפכים', short: 'מאגר', icon: BookOpenText, end: false },
];

function Logo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to={teacherPath()} className={cn('flex items-center gap-3 rounded-2xl', className)} aria-label="אלופי ההפכים – לוח הבקרה">
      <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-[0_8px_20px_-8px_rgba(139,92,246,.8)] ring-1 ring-white/60">
        <span className="absolute inset-x-2 top-1 h-3 rounded-full bg-white/40 blur-[2px]" aria-hidden />
        <img src="/images/ui/logo.svg" alt="" className="relative size-8 drop-shadow" />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-base font-black tracking-tight text-brand-navy">אלופי ההפכים</span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-violet">ממשק המורה</span>
        </span>
      )}
    </Link>
  );
}

function SidebarNav({ onNavigate, layoutId }: { onNavigate?: () => void; layoutId: string }) {
  const reduce = useReducedMotion();
  return (
    <nav aria-label="ניווט ראשי" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex min-h-12 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-violet/30',
              isActive ? 'text-white' : 'text-slate-600 hover:bg-white/70 hover:text-brand-navy',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId={layoutId}
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }}
                  className="absolute inset-0 rounded-2xl bg-linear-to-l from-violet-500 to-fuchsia-500 shadow-[0_10px_22px_-10px_rgba(139,92,246,.9)] ring-1 ring-white/30"
                  aria-hidden
                />
              )}
              <span className={cn('relative grid size-9 place-items-center rounded-xl transition-colors', isActive ? 'bg-white/20' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-brand-violet')}>
                <Icon className="size-[18px]" aria-hidden />
              </span>
              <span className="relative flex-1">{label}</span>
              {isActive && <ChevronLeft className="relative size-4 opacity-80" aria-hidden />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function TeacherChip({ name, email, onLogout, loggingOut, compact }: { name?: string; email?: string; onLogout: () => void; loggingOut: boolean; compact?: boolean }) {
  const initial = (name ?? '?').trim().charAt(0) || '?';
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl', compact ? '' : 'bg-white/70 p-2.5 ring-1 ring-white/80 shadow-[0_6px_18px_-12px_rgba(30,41,59,.4)]')}>
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-yellow-300 to-amber-400 text-sm font-black text-brand-navy shadow-[0_6px_14px_-6px_rgba(245,158,11,.8)] ring-2 ring-white">
        {initial}
        <span className="absolute -bottom-0.5 -end-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-white" aria-hidden />
      </span>
      {!compact && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-bold text-brand-navy">{name}</span>
          <span className="block truncate text-[11px] text-slate-500" dir="ltr">
            {email}
          </span>
        </span>
      )}
      {!compact && (
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="grid size-9 min-h-0 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          aria-label="התנתקות"
          title="התנתקות"
        >
          <LogOut className="size-[18px]" aria-hidden />
        </button>
      )}
    </div>
  );
}

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  if (crumbs.length === 0) return null;
  return (
    <nav aria-label="פירורי לחם" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {c.to && !last ? (
                <Link to={c.to} className="truncate rounded-md font-semibold text-slate-500 transition-colors hover:text-brand-violet">
                  {c.label}
                </Link>
              ) : (
                <span className={cn('truncate', last ? 'font-bold text-brand-navy' : 'text-slate-500')} aria-current={last ? 'page' : undefined}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronLeft className="size-3.5 shrink-0 text-slate-300" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="ניווט תחתון"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-white/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_-18px_rgba(30,41,59,.35)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto grid h-[4.5rem] max-w-md grid-cols-3 items-stretch px-2">
        {NAV.map(({ to, short, icon: Icon, end }) => (
          <li key={to} className="flex">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-bold transition-colors', isActive ? 'text-brand-violet' : 'text-slate-500')
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-8 w-14 place-items-center rounded-full transition-all',
                      isActive ? 'bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_8px_18px_-8px_rgba(139,92,246,.9)]' : 'bg-transparent',
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {short}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function TeacherLayout() {
  const authStatus = useTeacherStore((s) => s.authStatus);
  const profile = useTeacherStore((s) => s.profile);
  const checkAuth = useTeacherStore((s) => s.checkAuth);
  const logout = useTeacherStore((s) => s.logout);
  const location = useLocation();
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [crumbs, setCrumbsState] = useState<Crumb[]>([]);
  const setCrumbs = useCallback((next: Crumb[]) => setCrumbsState(next), []);

  useEffect(() => {
    if (authStatus === 'checking') void checkAuth();
  }, [authStatus, checkAuth]);

  // סגירת המגירה בניווט + Esc
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  if (authStatus === 'checking') {
    return (
      <div dir="rtl" className="relative flex min-h-dvh items-center justify-center">
        <FloatingBlobs />
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Spinner className="text-brand-violet" />
          <span className="text-sm font-semibold">בודקים התחברות…</span>
        </div>
      </div>
    );
  }

  if (authStatus === 'anonymous') {
    return <Navigate to={teacherPath('login')} replace state={{ from: location.pathname }} />;
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success('התנתקת בהצלחה');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <TeacherChromeContext.Provider value={{ setCrumbs }}>
      <div dir="rtl" className="relative min-h-dvh text-slate-800">
        <FloatingBlobs />

        <div className="lg:flex">
          {/* סרגל צד – מסכים גדולים */}
          <aside className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-l border-white/70 bg-white/60 p-4 shadow-[8px_0_40px_-30px_rgba(30,41,59,.35)] backdrop-blur-xl lg:flex">
            <div className="px-1 py-2">
              <Logo />
            </div>
            <div className="mt-6 flex-1">
              <div className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">תפריט</div>
              <SidebarNav layoutId="sidebar-active" />
              <div className="mt-6 overflow-hidden rounded-2xl bg-linear-to-br from-violet-500/10 via-sky-400/10 to-transparent p-4 ring-1 ring-violet-200/50">
                <div className="flex items-center gap-2 text-sm font-bold text-brand-navy">
                  <Sparkles className="size-4 text-brand-violet" aria-hidden />
                  טיפ קטן
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">הציגו את קוד החדר על הלוח – התלמידים מצטרפים בסריקה אחת מהטאבלט.</p>
              </div>
            </div>
            <TeacherChip name={profile?.name} email={profile?.email} onLogout={handleLogout} loggingOut={loggingOut} />
          </aside>

          <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
            {/* סרגל עליון */}
            <header className="sticky top-0 z-30 border-b border-white/70 bg-white/70 backdrop-blur-xl">
              <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-10">
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-expanded={menuOpen}
                  aria-controls="teacher-drawer"
                  aria-label="פתיחת תפריט"
                  className="grid size-11 min-h-0 shrink-0 place-items-center rounded-xl text-brand-navy transition-colors hover:bg-white lg:hidden"
                >
                  <Menu className="size-6" aria-hidden />
                </button>
                <div className="lg:hidden">
                  <Logo compact />
                </div>
                <div className="hidden min-w-0 flex-1 lg:block">
                  <Breadcrumbs crumbs={crumbs} />
                </div>
                <div className="min-w-0 flex-1 lg:hidden">
                  <div className="truncate text-sm font-black text-brand-navy">{crumbs[crumbs.length - 1]?.label ?? 'ממשק המורה'}</div>
                </div>
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200/70">
                    <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                    מחובר/ת
                  </span>
                </div>
                <div className="lg:hidden">
                  <TeacherChip compact name={profile?.name} onLogout={handleLogout} loggingOut={loggingOut} />
                </div>
              </div>
            </header>

            <main className="flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6 lg:px-10 lg:pb-12 lg:pt-8">
              <div className="mx-auto w-full max-w-7xl">
                <Outlet />
              </div>
            </main>
          </div>
        </div>

        {/* מגירה – נייד/טאבלט */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div
                key="backdrop"
                className="fixed inset-0 z-40 bg-brand-navy/40 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <motion.div
                key="drawer"
                id="teacher-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="תפריט"
                className="fixed inset-y-0 right-0 z-50 flex w-[min(86vw,20rem)] flex-col bg-white/90 p-4 shadow-2xl backdrop-blur-xl lg:hidden"
                initial={reduce ? { opacity: 0 } : { x: '100%' }}
                animate={reduce ? { opacity: 1 } : { x: 0 }}
                exit={reduce ? { opacity: 0 } : { x: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              >
                <div className="flex items-center justify-between">
                  <Logo />
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="סגירת תפריט"
                    className="grid size-11 min-h-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
                  >
                    <X className="size-6" aria-hidden />
                  </button>
                </div>
                <div className="mt-6 flex-1">
                  <SidebarNav layoutId="drawer-active" onNavigate={() => setMenuOpen(false)} />
                </div>
                <TeacherChip name={profile?.name} email={profile?.email} onLogout={handleLogout} loggingOut={loggingOut} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </TeacherChromeContext.Provider>
  );
}

export default TeacherLayout;
