// Adapted from 21st.dev — Number Ticker by danielpetho (fancycomponents.dev). Tweens a number with motion values.
import { useEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type ValueAnimationTransition } from 'motion/react';

export interface NumberTickerProps {
  /** הערך הנוכחי – כל שינוי מתנפש מהערך הקודם */
  value: number;
  /** פורמט (ברירת מחדל: מפריד אלפים עברי) */
  format?: (n: number) => string;
  transition?: ValueAnimationTransition;
  className?: string;
  /** מתחיל מ־0 ברינדור הראשון (ברירת מחדל: מתחיל מהערך עצמו) */
  fromZero?: boolean;
}

const DEFAULT_TRANSITION: ValueAnimationTransition = { duration: 0.9, type: 'tween', ease: [0.22, 1, 0.36, 1] };
const defaultFormat = (n: number) => new Intl.NumberFormat('he-IL').format(Math.round(n));

/** מספר "מתגלגל" – ניקוד, מונה שחקנים וכו׳. מכבד prefers-reduced-motion. */
export function NumberTicker({ value, format = defaultFormat, transition = DEFAULT_TRANSITION, className, fromZero = false }: NumberTickerProps) {
  const reduce = useReducedMotion();
  const count = useMotionValue(fromZero ? 0 : value);
  const text = useTransform(count, (latest) => format(latest));
  const first = useRef(true);

  useEffect(() => {
    if (reduce) {
      count.set(value);
      return;
    }
    if (first.current && !fromZero) {
      first.current = false;
      count.set(value);
      return;
    }
    first.current = false;
    const controls = animate(count, value, transition);
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return (
    <motion.span className={className} dir="ltr">
      {text}
    </motion.span>
  );
}
