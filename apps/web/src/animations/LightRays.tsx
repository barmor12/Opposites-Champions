import { cn } from '@/lib/cn';

export interface LightRaysProps {
  /** צבע הקרניים (ברירת מחדל: לבן־זהוב) */
  color?: string;
  /** מספר קרניים */
  count?: number;
  /** עוצמה 0–1 */
  intensity?: number;
  className?: string;
  /** להסתובב (ברירת מחדל: כן) */
  spin?: boolean;
}

/**
 * LightRays – קרני אור מסתובבות (conic-gradient) מאחורי דמות/גביע/תיבה.
 * absolute + pointer-events none. מכבד prefers-reduced-motion דרך ה־CSS הגלובלי.
 */
export function LightRays({ color = 'rgb(255 255 255)', count = 12, intensity = 0.35, className, spin = true }: LightRaysProps) {
  const step = 360 / count;
  const half = step / 2;
  const stops: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = i * step;
    stops.push(`transparent ${a}deg`, `${color} ${a + half * 0.35}deg`, `${color} ${a + half * 0.65}deg`, `transparent ${a + half}deg`);
  }
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[160%] -translate-x-1/2 -translate-y-1/2', spin && 'animate-rays', className)}
      style={{
        opacity: intensity,
        backgroundImage: `conic-gradient(from 0deg, ${stops.join(', ')})`,
        maskImage: 'radial-gradient(circle, rgb(0 0 0) 0%, rgb(0 0 0 / 0.6) 45%, transparent 72%)',
        WebkitMaskImage: 'radial-gradient(circle, rgb(0 0 0) 0%, rgb(0 0 0 / 0.6) 45%, transparent 72%)',
        willChange: spin ? 'transform' : undefined,
      }}
    />
  );
}

export default LightRays;
