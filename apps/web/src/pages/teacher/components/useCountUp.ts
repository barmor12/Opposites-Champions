import { useEffect } from 'react';
import { animate, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react';

/**
 * ספירה מונפשת מהערך הקודם לערך החדש (count-up) – מבוסס על 21st.dev Number Ticker (danielpetho):
 * MotionValue שמתעדכן מחוץ למחזור הרינדור של React. מכבד prefers-reduced-motion.
 */
export function useCountUp(target: number | null | undefined, { duration = 1.1 }: { duration?: number } = {}): MotionValue<number> {
  const reduce = useReducedMotion();
  const value = useMotionValue(typeof target === 'number' && Number.isFinite(target) ? target : 0);

  useEffect(() => {
    if (target === null || target === undefined || !Number.isFinite(target)) return;
    if (reduce) {
      value.set(target);
      return;
    }
    const controls = animate(value, target, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [target, reduce, duration, value]);

  return value;
}
