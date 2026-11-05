import { useCountUp } from './useCountUp';

export interface CountUpProps {
  value: number | null | undefined;
  format?: (n: number) => string;
  placeholder?: string;
  className?: string;
}

/** מספר עם אנימציית ספירה – לכרטיסי KPI ומונים חיים. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('he-IL'), placeholder = '—', className }: CountUpProps) {
  const n = useCountUp(value);
  return (
    <span className={className} data-value={value ?? undefined}>
      {n === null ? placeholder : format(n)}
    </span>
  );
}
