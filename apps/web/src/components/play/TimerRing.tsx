import { useEffect, useId, useRef, useState } from 'react';
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

const PALETTE = {
  calm: { from: '#4ade80', to: '#059669', glow: 'rgba(34,197,94,0.55)', text: 'text-green-700' },
  warn: { from: '#fbbf24', to: '#ea580c', glow: 'rgba(249,115,22,0.55)', text: 'text-orange-600' },
  urgent: { from: '#fb7185', to: '#be123c', glow: 'rgba(244,63,94,0.6)', text: 'text-rose-600' },
};

/** טבעת טיימר מסונכרנת לשרת – קשת גרדיאנט זוהרת, ירוק → כתום → אדום, פעימה ב־5 השניות האחרונות */
export function TimerRing({ endsAt, totalMs, serverOffsetMs, onExpire, paused, size = 72, className }: TimerRingProps) {
  const uid = useId();
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
      <span className={cn('inline-flex items-center gap-1 text-slate-500', className)} aria-label="לְלֹא הַגְבָּלַת זְמַן">
        <Clock className="size-6" aria-hidden /> <span className="text-sm font-bold">לְלֹא הַגְבָּלָה</span>
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(totalMs, remaining));
  const fraction = clamped / totalMs;
  const seconds = Math.ceil(clamped / 1000);
  const stroke = Math.max(7, Math.round(size * 0.12));
  const r = (size - stroke) / 2 - 1;
  const c = 2 * Math.PI * r;
  const pal = fraction > 0.5 ? PALETTE.calm : fraction > 0.25 ? PALETTE.warn : PALETTE.urgent;
  const urgent = seconds <= 5 && seconds > 0;
  const gradId = `tr-${uid}`;

  return (
    <div
      role="timer"
      aria-live={urgent ? 'assertive' : 'off'}
      aria-label={`נִשְׁאֲרוּ ${seconds} שְׁנִיּוֹת`}
      className={cn('relative grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      {urgent && !paused && (
        <span aria-hidden className="absolute inset-0 rounded-full animate-pulse-ring" style={{ boxShadow: `0 0 0 3px ${pal.glow}` }} />
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn('-rotate-90', urgent && !paused && 'animate-wiggle')} aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={pal.from} />
            <stop offset="1" stopColor={pal.to} />
          </linearGradient>
        </defs>
        {/* דִּיסְקָה לְבָנָה עִם הַבְלָטָה */}
        <circle cx={size / 2} cy={size / 2} r={r + stroke / 2} fill="url(#timer-disc)" />
        <defs>
          <radialGradient id="timer-disc" cx="0.4" cy="0.35" r="0.8">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#e2e8f0" />
          </radialGradient>
        </defs>
        {/* מְסִילָּה שְׁקוּעָה */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#cbd5e1" strokeOpacity="0.7" strokeWidth={stroke} />
        {/* קֶשֶׁת */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          className="transition-[stroke-dashoffset] duration-100 ease-linear"
          style={{ filter: `drop-shadow(0 0 ${Math.round(stroke * 0.8)}px ${pal.glow})` }}
        />
      </svg>
      <span
        className={cn('absolute font-black tabular-nums text-shadow-pop', size >= 72 ? 'text-2xl' : 'text-lg', pal.text, urgent && !paused && 'animate-bounce-soft')}
        dir="ltr"
      >
        {seconds}
      </span>
    </div>
  );
}
