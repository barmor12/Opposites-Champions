import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

export interface StarBurstProps {
  /** כל שינוי בערך (שונה מ־0) מפעיל פרץ כוכבים */
  trigger: number;
  /** מספר כוכבים בפרץ */
  count?: number;
  className?: string;
}

const COLORS = ['#FACC15', '#F9A8D4', '#38BDF8', '#8B5CF6', '#22C55E', '#FB923C'];

/**
 * StarBurst – פרץ כוכבים ממרכז המיכל (absolute). יש למקם בתוך אלמנט relative.
 */
export function StarBurst({ trigger, count = 12, className = '' }: StarBurstProps) {
  const reduced = useReducedMotion();
  const [bursts, setBursts] = useState<number[]>([]);
  const [lastTrigger, setLastTrigger] = useState(trigger);
  if (trigger !== lastTrigger) {
    // "adjusting state during render": כל שינוי ב־trigger מוסיף פרץ חדש
    setLastTrigger(trigger);
    if (trigger) setBursts((b) => (b.includes(trigger) ? b : [...b, trigger]));
  }
  const remove = (id: number) => setBursts((b) => b.filter((x) => x !== id));

  if (reduced) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="star-burst"
      className={`pointer-events-none absolute inset-0 z-30 overflow-visible ${className}`}
    >
      <AnimatePresence>
        {bursts.map((id) => (
          <motion.div
            key={id}
            className="absolute left-1/2 top-1/2"
            initial={{ opacity: 1 }}
            animate={{ opacity: [1, 1, 0] }}
            transition={{ duration: 1.1, times: [0, 0.8, 1] }}
            onAnimationComplete={() => remove(id)}
          >
            {Array.from({ length: count }, (_, i) => {
              const angle = (i / count) * Math.PI * 2 + (id % 7) * 0.1;
              const dist = 90 + (i % 3) * 40;
              const size = 14 + (i % 4) * 6;
              return (
                <motion.svg
                  key={i}
                  viewBox="0 0 24 24"
                  width={size}
                  height={size}
                  style={{ position: 'absolute', left: -size / 2, top: -size / 2 }}
                  initial={{ x: 0, y: 0, scale: 0.2, opacity: 1, rotate: 0 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist,
                    scale: [0.2, 1.3, 0.8],
                    opacity: [1, 1, 0],
                    rotate: 180,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                >
                  <path
                    d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"
                    fill={COLORS[i % COLORS.length]}
                  />
                </motion.svg>
              );
            })}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default StarBurst;
