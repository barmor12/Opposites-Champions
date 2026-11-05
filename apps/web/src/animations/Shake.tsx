import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export interface ShakeProps {
  /** כאשר true – מתבצע ניעור עדין (לתשובה שגויה) */
  active: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Shake – עטיפה המנערת את התוכן אופקית כשהיא פעילה. מכבדת prefers-reduced-motion.
 */
export function Shake({ active, children, className }: ShakeProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      data-testid="shake"
      data-active={active ? 'true' : 'false'}
      animate={active && !reduced ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

export default Shake;
