import { motion, useReducedMotion } from 'motion/react';
import { Check, Star } from 'lucide-react';
import { TREASURE_QUESTIONS } from '@oc/shared';
import { cn } from './_ui';
import { TreasureChestImage } from './TreasureChest';

export interface TreasurePathProps {
  step: number; // 1..total
  total?: number;
  completed?: boolean; // כל השלבים הושלמו
}

/** מסלול האוצר – 5 תחנות, סמן התלמיד בשלב הנוכחי, תחנות שהושלמו דולקות, תיבה בסוף */
export function TreasurePath({ step, total = TREASURE_QUESTIONS, completed = false }: TreasurePathProps) {
  const reduced = useReducedMotion();
  const safeStep = Math.min(Math.max(1, step), total);
  return (
    <section
      aria-label={`אתגר האוצר – שלב ${safeStep} מתוך ${total}`}
      data-testid="treasure-path"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-amber-100 via-yellow-50 to-orange-100 px-4 py-3 shadow-md ring-2 ring-amber-200"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-black text-amber-900 sm:text-xl">
          <span aria-hidden="true">🗺️ </span>
          אתגר האוצר – שלב {safeStep} מתוך {total}
        </h2>
        <span className="rounded-full bg-amber-200 px-3 py-0.5 text-sm font-bold text-amber-900">
          {completed ? 'הושלם!' : 'ענו נכון כדי להתקדם'}
        </span>
      </div>
      <ol className="flex items-center gap-1 sm:gap-2" dir="rtl">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const done = completed || n < safeStep;
          const current = !completed && n === safeStep;
          return (
            <li key={n} className="flex flex-1 items-center">
              <div className="relative flex flex-col items-center">
                <motion.div
                  initial={false}
                  animate={done ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-4 text-base font-black sm:h-12 sm:w-12',
                    done && 'border-yellow-500 bg-yellow-400 text-yellow-900 shadow-[0_0_18px_4px_rgba(250,204,21,0.6)]',
                    current && 'border-pink-400 bg-white text-pink-600',
                    !done && !current && 'border-amber-300 bg-amber-50 text-amber-400',
                  )}
                  aria-current={current ? 'step' : undefined}
                  aria-label={`שלב ${n}${done ? ' – הושלם' : current ? ' – נוכחי' : ''}`}
                >
                  {done ? <Check className="h-6 w-6" strokeWidth={3.5} /> : current ? n : <Star className="h-5 w-5" />}
                </motion.div>
                {current && (
                  <motion.div
                    aria-hidden="true"
                    data-testid="treasure-marker"
                    className="absolute -top-7 text-2xl drop-shadow"
                    animate={reduced ? undefined : { y: [0, -5, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    🧑‍🚀
                  </motion.div>
                )}
              </div>
              <div
                aria-hidden="true"
                className={cn(
                  'mx-1 h-2 flex-1 rounded-full',
                  done ? 'bg-yellow-400' : 'bg-amber-200',
                )}
              />
            </li>
          );
        })}
        <li className="flex items-center">
          <motion.div
            className="h-14 w-16 sm:h-16 sm:w-20"
            animate={reduced ? undefined : { rotate: [0, -4, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 }}
          >
            <TreasureChestImage open={completed} className="h-full w-full" />
          </motion.div>
        </li>
      </ol>
    </section>
  );
}
