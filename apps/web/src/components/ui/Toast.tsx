import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, CircleX, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastType = 'success' | 'error' | 'info';
export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (type: ToastType, message: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (type, message, durationMs = type === 'error' ? 6000 : 3500) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, type, message, durationMs }].slice(-4) });
    if (durationMs > 0 && typeof setTimeout === 'function') {
      timers.set(id, setTimeout(() => get().dismiss(id), durationMs));
    }
    return id;
  },
  dismiss: (id) => {
    const t = timers.get(id);
    if (t) clearTimeout(t);
    timers.delete(id);
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
  clear: () => {
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
    set({ toasts: [] });
  },
}));

/** API נוח: toast.success('…') / toast.error('…') / toast.info('…') */
export const toast = {
  success: (message: string, durationMs?: number) => useToastStore.getState().push('success', message, durationMs),
  error: (message: string, durationMs?: number) => useToastStore.getState().push('error', message, durationMs),
  info: (message: string, durationMs?: number) => useToastStore.getState().push('info', message, durationMs),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};

const STYLES: Record<ToastType, { box: string; Icon: typeof Info; label: string }> = {
  success: { box: 'bg-green-600 text-white', Icon: CircleCheck, label: 'הצלחה' },
  error: { box: 'bg-rose-600 text-white', Icon: CircleX, label: 'שגיאה' },
  info: { box: 'bg-brand-navy text-white', Icon: Info, label: 'הודעה' },
};

/** מיכל ההודעות – למקם פעם אחת ב־App */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3 sm:top-5"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { box, Icon, label } = STYLES[t.type];
          return (
            <motion.div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={cn(
                'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 shadow-pop font-bold text-base sm:text-lg',
                box,
              )}
            >
              <Icon className="size-6 shrink-0" aria-hidden />
              <span className="sr-only">{label}: </span>
              <span className="flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="סגירת הודעה"
                className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/20"
              >
                <X className="size-5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
