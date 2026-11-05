import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

export interface FloatingStarsProps {
  count?: number;
  className?: string;
}

// seeded pseudo random so the layout is stable between renders
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_COLORS = ['#FACC15', '#F9A8D4', '#38BDF8', '#8B5CF6', '#FB923C'];

/**
 * FloatingStars – כוכבים דקורטיביים המרחפים ברקע (absolute, pointer-events none).
 * יש למקם בתוך אלמנט עם position: relative.
 */
export function FloatingStars({ count = 12, className = '' }: FloatingStarsProps) {
  const reduced = useReducedMotion();
  const stars = useMemo(() => {
    const rnd = mulberry32(count * 7919 + 13);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: rnd() * 100,
      top: rnd() * 100,
      size: 10 + rnd() * 18,
      delay: rnd() * 4,
      duration: 4 + rnd() * 4,
      color: STAR_COLORS[i % STAR_COLORS.length] ?? '#FACC15',
      drift: 8 + rnd() * 16,
    }));
  }, [count]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      data-testid="floating-stars"
    >
      {stars.map((s) => (
        <motion.svg
          key={s.id}
          viewBox="0 0 24 24"
          width={s.size}
          height={s.size}
          style={{ position: 'absolute', left: `${s.left}%`, top: `${s.top}%`, opacity: 0.55 }}
          initial={false}
          animate={
            reduced
              ? undefined
              : { y: [0, -s.drift, 0], rotate: [0, 15, -10, 0], opacity: [0.35, 0.8, 0.35], scale: [1, 1.15, 1] }
          }
          transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"
            fill={s.color}
          />
        </motion.svg>
      ))}
    </div>
  );
}

export default FloatingStars;
