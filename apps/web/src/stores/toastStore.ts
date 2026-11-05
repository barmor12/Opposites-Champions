import { create } from 'zustand';

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
    if (durationMs > 0) timers.set(id, setTimeout(() => get().dismiss(id), durationMs));
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
