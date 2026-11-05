import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TimerRingProps {
  /** זמן סיום לפי שעון השרת (epoch ms) */
  endsAt: number | null;
  /** משך השאלה המלא */
  totalMs: number;
  serverOffsetMs: number;
  /** נקרא פעם אחת כשהזמן נגמר */
  onExpire?: () => void;
  paused?: boolean;
  size?: number;
  className?: string;
}

/** טבעת טיימר מסונכרנת לשרת – ירוק → כתום → אדום */
export function TimerRing({ endsAt, totalMs, serverOffsetMs, onExpire, paused, size = 72, className }: TimerRingProps) {
  const [remaining, setRemaining] = useState<number>(() => (endsAt ? endsAt - (Date.now() + serverOffsetMs) : totalMs));
  const expiredFor = useRef<number | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!endsAt || paused) return;
    const tick = () => {
      const r = endsAt - (Date.now() + serverOffsetMs);
      setRemaining(r);
      if (r <= 0 && expiredFor.current !== endsAt) {
        expiredFor.current = endsAt;
        onExpireRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt, serverOffsetMs, paused]);

  if (!endsAt || totalMs <= 0) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-slate-500', className)} aria-label="ללא הגבלת זמן">
        <Clock className="size-6" aria-hidden /> <span className="text-sm font-bold">ללא הגבלה</span>
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(totalMs, remaining));
  const fraction = clamped / totalMs;
  const seconds = Math.ceil(clamped / 1000);
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = fraction > 0.5 ? 'text-brand-green' : fraction > 0.25 ? 'text-brand-orange' : 'text-rose-500';
  const urgent = seconds <= 5 && seconds > 0;

  return (
    <div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      aria-label={`נשארו ${seconds} שניות`}
      className={cn('relative grid place-items-center', urgent && 'animate-wiggle', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="white" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          className={cn('transition-[stroke-dashoffset] duration-100 ease-linear', color)}
        />
      </svg>
      <span className={cn('absolute font-black tabular-nums', size >= 72 ? 'text-2xl' : 'text-lg', color)} dir="ltr">
        {seconds}
      </span>
    </div>
  );
}
