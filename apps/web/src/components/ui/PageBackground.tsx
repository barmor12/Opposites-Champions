// Floating gradient blobs adapted from 21st.dev — Floating Gradient by moumensoliman (blurred colour blobs drifting on slow loops).
import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

export interface PageBackgroundProps {
  variant?: 'day' | 'sunset' | 'night';
  /** להציג קשת (מתאים למסך הפתיחה והתוצאות) */
  rainbow?: boolean;
  className?: string;
  /** בלונים מרחפים (ברירת מחדל: כן ביום/שקיעה) */
  balloons?: boolean;
}

const SKY: Record<NonNullable<PageBackgroundProps['variant']>, string> = {
  day: 'linear-gradient(180deg, #1ea7e8 0%, #5ccbfa 22%, #a7e3fd 48%, #e3f5ff 70%, #fff7dc 100%)',
  sunset: 'linear-gradient(180deg, #5b3fd6 0%, #9b6cf0 24%, #f1a2d3 52%, #ffd0a6 76%, #fff2d6 100%)',
  night: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 35%, #5b21b6 70%, #7c3aed 100%)',
};

const BLOBS: Record<NonNullable<PageBackgroundProps['variant']>, string[]> = {
  day: ['from-sky-300 to-violet-300', 'from-pink-300 to-orange-200', 'from-emerald-200 to-cyan-200'],
  sunset: ['from-fuchsia-300 to-violet-400', 'from-orange-200 to-pink-300', 'from-amber-200 to-rose-200'],
  night: ['from-indigo-500 to-violet-500', 'from-fuchsia-500 to-purple-600', 'from-sky-500 to-indigo-600'],
};

function Cloud({ className, style, depth = 1, dark = false }: { className?: string; style?: React.CSSProperties; depth?: number; dark?: boolean }) {
  return (
    <svg
      viewBox="0 0 220 120"
      aria-hidden
      className={cn('parallax-layer absolute', dark ? 'text-white/75' : 'text-white', className)}
      style={{ ...style, ['--depth' as string]: depth }}
    >
      <defs>
        <linearGradient id="cloud-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dbeafe" />
        </linearGradient>
        <linearGradient id="cloud-shade" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" stopOpacity="0" />
          <stop offset="1" stopColor="#93c5fd" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* צל נופל רך */}
      <ellipse cx="112" cy="104" rx="80" ry="11" fill="#1e3a8a" opacity="0.08" />
      {/* נפח */}
      <g fill="url(#cloud-fill)">
        <ellipse cx="60" cy="76" rx="54" ry="34" />
        <ellipse cx="112" cy="56" rx="52" ry="44" />
        <ellipse cx="160" cy="76" rx="46" ry="32" />
        <rect x="20" y="74" width="180" height="36" rx="18" />
      </g>
      {/* צל פנימי בתחתית */}
      <g fill="url(#cloud-shade)">
        <ellipse cx="60" cy="88" rx="50" ry="22" />
        <ellipse cx="160" cy="88" rx="44" ry="20" />
        <rect x="20" y="86" width="180" height="24" rx="12" />
      </g>
      {/* highlight עליון */}
      <ellipse cx="104" cy="34" rx="30" ry="14" fill="#fff" opacity="0.7" />
      <ellipse cx="54" cy="58" rx="18" ry="9" fill="#fff" opacity="0.5" />
    </svg>
  );
}

function Star({ className, delay = 0, depth = 0.4 }: { className?: string; delay?: number; depth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('parallax-layer absolute animate-twinkle drop-shadow-[0_0_8px_rgba(250,204,21,0.9)]', className)}
      style={{ animationDelay: `${delay}s`, ['--depth' as string]: depth }}
    >
      <defs>
        <radialGradient id="star-fill" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
      <path fill="url(#star-fill)" d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
    </svg>
  );
}

function Balloon({ className, color, delay = 0, depth = 1.6 }: { className?: string; color: 'pink' | 'sky' | 'yellow' | 'violet'; delay?: number; depth?: number }) {
  const fills = {
    pink: ['#fbcfe8', '#ec4899', '#9d174d'],
    sky: ['#bae6fd', '#0ea5e9', '#075985'],
    yellow: ['#fef3c7', '#f59e0b', '#92400e'],
    violet: ['#ddd6fe', '#8b5cf6', '#4c1d95'],
  }[color];
  const id = `bal-${color}`;
  return (
    <svg
      viewBox="0 0 60 120"
      aria-hidden
      className={cn('parallax-layer absolute animate-balloon drop-shadow-[0_10px_14px_rgba(30,41,59,0.18)]', className)}
      style={{ animationDelay: `${delay}s`, ['--depth' as string]: depth }}
    >
      <defs>
        <radialGradient id={id} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor={fills[0]} />
          <stop offset="0.55" stopColor={fills[1]} />
          <stop offset="1" stopColor={fills[2]} />
        </radialGradient>
      </defs>
      <path d="M30 76 C 32 84, 28 92, 31 100 S 29 112, 32 118" stroke={fills[2]} strokeWidth="1.5" fill="none" opacity="0.6" />
      <ellipse cx="30" cy="38" rx="24" ry="30" fill={`url(#${id})`} />
      <ellipse cx="20" cy="22" rx="7" ry="11" fill="#fff" opacity="0.5" transform="rotate(-20 20 22)" />
      <path d="M26 67 L34 67 L30 74 Z" fill={fills[2]} />
    </svg>
  );
}

function Rainbow({ className }: { className?: string }) {
  const bands = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#8b5cf6'];
  return (
    <svg viewBox="0 0 400 200" aria-hidden className={cn('absolute opacity-80', className)}>
      <defs>
        <linearGradient id="rb-gloss" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {bands.map((c, i) => (
        <path key={c} d={`M${20 + i * 14} 200 A ${180 - i * 14} ${180 - i * 14} 0 0 1 ${380 - i * 14} 200`} fill="none" stroke={c} strokeWidth="13" strokeLinecap="round" />
      ))}
      <path d="M20 200 A 180 180 0 0 1 380 200" fill="none" stroke="url(#rb-gloss)" strokeWidth="26" strokeLinecap="round" />
    </svg>
  );
}

/** רקע עמוד קולנועי – שמיים רב־שכבתיים: שמש וקרניים, כתמי צבע מרחפים, עננים נפחיים, כוכבים, בלונים וקשת; פרלקס עדין; מכבד prefers-reduced-motion */
export function PageBackground({ variant = 'day', rainbow = true, className, balloons = true }: PageBackgroundProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  // פרלקס קל לפי מיקום הסמן (עכבר בלבד, לא בטאצ׳ ולא בהפחתת תנועה)
  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    if (window.matchMedia?.('(pointer: coarse)')?.matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const x = (e.clientX / window.innerWidth - 0.5) * -14;
        const y = (e.clientY / window.innerHeight - 0.5) * -10;
        el.style.setProperty('--parallax-x', `${x.toFixed(1)}px`);
        el.style.setProperty('--parallax-y', `${y.toFixed(1)}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduce]);

  const stars = useMemo(
    () => [
      { c: 'top-[9%] start-[7%] size-5 sm:size-7', d: 0 },
      { c: 'top-[16%] end-[12%] size-7 sm:size-9', d: 0.8 },
      { c: 'top-[34%] start-[13%] size-4 sm:size-5', d: 1.5 },
      { c: 'top-[42%] end-[6%] size-5 sm:size-6', d: 0.4 },
      { c: 'top-[64%] start-[4%] size-5', d: 2 },
      { c: 'top-[72%] end-[15%] size-6 sm:size-8', d: 1.1 },
      { c: 'top-[26%] start-[42%] size-3 sm:size-4', d: 2.4 },
      { c: 'top-[58%] end-[36%] size-3 sm:size-4', d: 1.8 },
    ],
    [],
  );
  const night = variant === 'night';
  const blobs = BLOBS[variant];

  return (
    <div ref={ref} aria-hidden className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)} style={{ background: SKY[variant] }}>
      {/* שמש / ירח + קרניים */}
      <div className={cn('parallax-layer absolute -top-[14%] -start-[10%] aspect-square w-[70vw] max-w-[760px] sm:-top-[22%] sm:w-[52vw]')} style={{ ['--depth' as string]: 0.3 }}>
        <div
          className={cn('absolute inset-0 rounded-full', !reduce && 'animate-rays')}
          style={{
            backgroundImage: night
              ? 'conic-gradient(from 0deg, transparent 0deg, rgb(255 255 255 / 0.08) 10deg, transparent 20deg, transparent 40deg, rgb(255 255 255 / 0.08) 50deg, transparent 60deg, transparent 80deg, rgb(255 255 255 / 0.08) 90deg, transparent 100deg, transparent 120deg, rgb(255 255 255 / 0.08) 130deg, transparent 140deg, transparent 160deg, rgb(255 255 255 / 0.08) 170deg, transparent 180deg, transparent 200deg, rgb(255 255 255 / 0.08) 210deg, transparent 220deg, transparent 240deg, rgb(255 255 255 / 0.08) 250deg, transparent 260deg, transparent 280deg, rgb(255 255 255 / 0.08) 290deg, transparent 300deg, transparent 320deg, rgb(255 255 255 / 0.08) 330deg, transparent 340deg, transparent 360deg)'
              : 'conic-gradient(from 0deg, transparent 0deg, rgb(255 251 214 / 0.55) 12deg, transparent 24deg, transparent 45deg, rgb(255 251 214 / 0.5) 57deg, transparent 69deg, transparent 90deg, rgb(255 251 214 / 0.55) 102deg, transparent 114deg, transparent 135deg, rgb(255 251 214 / 0.5) 147deg, transparent 159deg, transparent 180deg, rgb(255 251 214 / 0.55) 192deg, transparent 204deg, transparent 225deg, rgb(255 251 214 / 0.5) 237deg, transparent 249deg, transparent 270deg, rgb(255 251 214 / 0.55) 282deg, transparent 294deg, transparent 315deg, rgb(255 251 214 / 0.5) 327deg, transparent 339deg, transparent 360deg)',
            maskImage: 'radial-gradient(circle, rgb(0 0 0) 0%, rgb(0 0 0 / 0.5) 40%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle, rgb(0 0 0) 0%, rgb(0 0 0 / 0.5) 40%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-[22%] rounded-full blur-2xl"
          style={{ background: night ? 'radial-gradient(circle, rgb(255 255 255 / 0.55), rgb(199 210 254 / 0.25) 45%, transparent 70%)' : 'radial-gradient(circle, rgb(255 250 205 / 0.95), rgb(254 240 138 / 0.55) 40%, transparent 70%)' }}
        />
      </div>

      {/* כתמי צבע מרחפים */}
      {blobs.map((b, i) => (
        <motion.div
          key={b}
          className={cn('absolute aspect-square w-[60vw] max-w-[520px] rounded-full bg-gradient-to-r blur-3xl will-change-transform', b, night ? 'opacity-40' : 'opacity-30')}
          style={i === 0 ? { top: '8%', right: '-10%' } : i === 1 ? { bottom: '6%', left: '-12%' } : { top: '46%', left: '38%' }}
          animate={reduce ? undefined : { x: [0, i === 1 ? -70 : 70, 0], y: [0, i === 2 ? -80 : 50, 0], scale: [1, 1.18, 1] }}
          transition={{ duration: 9 + i * 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* עננים נפחיים (אחוריים – מטושטשים, קדמיים – חדים) */}
      {!night && (
        <>
          <Cloud className="top-[7%] -start-16 w-56 opacity-70 blur-[1.5px] sm:w-72" depth={0.5} dark />
          <Cloud className="top-[24%] -end-14 w-44 opacity-80 blur-[1px] sm:w-64" depth={0.7} dark />
          <Cloud className="top-[12%] end-[18%] w-28 opacity-60 blur-[2px] sm:w-40" depth={0.35} dark />
          <Cloud className="bottom-[28%] -start-10 w-48 sm:w-64" depth={1.2} />
          <Cloud className="bottom-[10%] end-[6%] w-52 sm:w-80" depth={1.5} />
        </>
      )}

      {/* כוכבים נוצצים */}
      {stars.map((s) => (
        <Star key={s.c} className={s.c} delay={s.d} depth={0.4 + (s.d % 1)} />
      ))}

      {/* בלונים */}
      {balloons && !night && !reduce && (
        <>
          <Balloon color="pink" className="top-[30%] -start-2 w-12 sm:start-[3%] sm:w-16 lg:w-20" delay={0} />
          <Balloon color="sky" className="top-[48%] end-[2%] hidden w-14 sm:block lg:w-[4.5rem]" delay={-5} depth={1.3} />
          <Balloon color="yellow" className="top-[18%] end-[30%] hidden w-10 lg:block" delay={-9} depth={0.9} />
          <Balloon color="violet" className="bottom-[22%] start-[22%] hidden w-12 lg:block" delay={-3} depth={1.8} />
        </>
      )}

      {/* קשת */}
      {rainbow && <Rainbow className="-bottom-10 start-1/2 w-[150vw] max-w-[980px] -translate-x-1/2 sm:w-[92vw]" />}

      {/* אובך קרקע – עומק */}
      <div className={cn('absolute inset-x-0 bottom-0 h-[28%]', night ? 'bg-gradient-to-t from-indigo-950/40 to-transparent' : 'bg-gradient-to-t from-white/55 to-transparent')} />
      {/* ויניטה עדינה */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(30 41 59 / 0.08) 100%)' }} />
    </div>
  );
}
