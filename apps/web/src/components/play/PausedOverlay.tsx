import { AnimatePresence, motion } from 'motion/react';
import { Pause } from 'lucide-react';
import { Character } from '@/components/ui';

export function PausedOverlay({ open }: { open: boolean }) {
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
          className="fixed inset-0 z-40 flex items-center justify-center bg-brand-navy/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="flex w-full max-w-md flex-col items-center gap-4 rounded-bubble bg-white p-8 text-center shadow-pop"
          >
            <Character name="moon" mood="think" size="md" animate="wiggle" />
            <span className="grid size-16 place-items-center rounded-full bg-orange-100 text-orange-600">
              <Pause className="size-9" aria-hidden />
            </span>
            <h2 id="paused-title" className="text-2xl font-black sm:text-3xl">המורה עצרה את המשחק לרגע</h2>
            <p className="text-lg text-slate-600">נשימה עמוקה… ממשיכים בקרוב!</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
