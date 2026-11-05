import { motion, useTransform } from 'motion/react';
import { useCountUp } from './useCountUp';

export interface CountUpProps {
  value: number | null | undefined;
  format?: (n: number) => string;
  placeholder?: string;
  className?: string;
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString('he-IL');

/** מספר עם אנימציית ספירה – לכרטיסי KPI ומונים חיים. */
export function CountUp({ value, format = defaultFormat, placeholder = '—', className }: CountUpProps) {
  const mv = useCountUp(value);
  const text = useTransform(mv, (v) => format(v));
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={className}>{placeholder}</span>;
  }
  return (
    <motion.span className={className} data-value={value}>
      {text}
    </motion.span>
  );
}
