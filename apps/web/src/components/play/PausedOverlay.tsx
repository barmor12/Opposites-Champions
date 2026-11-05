import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Pause } from 'lucide-react';
import { Character } from '@/components/ui';

export function PausedOverlay({ open }: { open: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="paused-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-b from-indigo-950/55 via-brand-navy/55 to-violet-950/65 p-4 backdrop-blur-lg"
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { scale: 0.85, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="relative flex w-full max-w-md flex-col items-center gap-4 rounded-bubble glass-strong p-7 text-center ring-1 ring-white/80 sm:p-9"
          >
            <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
            <Character name="moon" mood="think" size="md" animate="wiggle" />
            <span className="grid size-16 place-items-center rounded-full bg-gradient-to-b from-orange-200 to-orange-400 text-orange-900 shadow-[inset_0_2px_0_rgba(255,255,255,0.7),0_8px_16px_-6px_rgba(194,65,12,0.5)] ring-4 ring-white">
              <Pause className="size-9" aria-hidden />
            </span>
            <h2 id="paused-title" className="text-fluid-title font-black text-brand-navy">המורה עצרה את המשחק לרגע</h2>
            <p className="text-lg text-slate-600">נשימה עמוקה… ממשיכים בקרוב!</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
