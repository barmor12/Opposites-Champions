import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

/**
 * ספירה מונפשת מהערך הקודם לערך החדש (count-up).
 * מכבד prefers-reduced-motion – במצב כזה הערך מוצג מיד.
 */
export function useCountUp(target: number | null | undefined, { duration = 1.1 }: { duration?: number } = {}): number | null {
  const reduce = useReducedMotion();
  const previous = useRef(0);
  const [value, setValue] = useState<number | null>(target ?? null);

  useEffect(() => {
    if (target === null || target === undefined || !Number.isFinite(target)) {
      setValue(null);
      return;
    }
    if (reduce) {
      previous.current = target;
      setValue(target);
      return;
    }
    const from = previous.current;
    const controls = animate(from, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setValue(v),
      onComplete: () => {
        previous.current = target;
        setValue(target);
      },
    });
    return () => controls.stop();
  }, [target, reduce, duration]);

  return value;
}
