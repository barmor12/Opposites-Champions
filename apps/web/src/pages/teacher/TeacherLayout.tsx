import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { BookOpenText, LayoutDashboard, LogOut, Menu, PlusCircle, X } from 'lucide-react';
import { Spinner, toast } from '@/components/ui';
import { useTeacherStore } from '@/stores/teacherStore';
import { teacherPath } from './labels';

const NAV = [
  { to: teacherPath(), label: 'לוח בקרה', icon: LayoutDashboard, end: true },
  { to: teacherPath('new'), label: 'משחק חדש', icon: PlusCircle, end: false },
  { to: teacherPath('content'), label: 'מאגר ההפכים', icon: BookOpenText, end: false },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/images/ui/logo.svg" alt="" className="h-10 w-10 rounded-xl" />
      {!compact && (
        <div className="leading-tight">
          <div className="text-base font-extrabold text-brand-navy">אלופי ההפכים</div>
          <div className="text-xs text-slate-500">ממשק המורה</div>
        </div>
      )}
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="ניווט ראשי" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive ? 'bg-brand-violet text-white shadow-sm' : 'text-slate-600 hover:bg-brand-violet/10 hover:text-brand-violet'
            }`
          }
        >
          <Icon className="h-5 w-5" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export function TeacherLayout() {
  const authStatus = useTeacherStore((s) => s.authStatus);
  const profile = useTeacherStore((s) => s.profile);
  const checkAuth = useTeacherStore((s) => s.checkAuth);
  const logout = useTeacherStore((s) => s.logout);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (authStatus === 'checking') void checkAuth();
  }, [authStatus, checkAuth]);

  if (authStatus === 'checking') {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Spinner />
          <span className="text-sm">בודקים התחברות…</span>
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

  const userBlock = (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow text-sm font-bold text-brand-navy">
          {(profile?.name ?? '?').trim().charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-brand-navy">{profile?.name}</div>
          <div className="truncate text-xs text-slate-500">{profile?.email}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        aria-label="התנתקות"
        title="התנתקות"
      >
        <LogOut className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-800 lg:flex">
      {/* סרגל צד – מסכים גדולים */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-l border-slate-200 bg-white p-4 lg:flex">
        <div className="px-2 py-2">
          <Logo />
        </div>
        <div className="mt-6 flex-1">
          <NavItems />
        </div>
        {userBlock}
      </aside>

      {/* סרגל עליון – טאבלט/נייד */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'סגירת תפריט' : 'פתיחת תפריט'}
          className="rounded-xl p-2 text-brand-navy hover:bg-slate-100"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-x-0 top-[65px] z-20 border-b border-slate-200 bg-white p-4 shadow-lg lg:hidden">
          <NavItems onNavigate={() => setMenuOpen(false)} />
          <div className="mt-4">{userBlock}</div>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default TeacherLayout;
