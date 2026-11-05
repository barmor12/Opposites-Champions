// מבוסס על 21st.dev — Floating Gradient (moumensoliman): כתמי צבע מטושטשים שנעים לאט מאחורי התוכן.
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';

const BLOBS = [
  { className: 'from-sky-300 to-violet-300', style: { top: '-8%', right: '-6%' }, x: [0, -60, 0], y: [0, 40, 0], scale: [1, 1.15, 1], duration: 14 },
  { className: 'from-pink-300 to-orange-200', style: { bottom: '-10%', left: '-8%' }, x: [0, 70, 0], y: [0, -50, 0], scale: [1, 1.25, 1], duration: 18 },
  { className: 'from-emerald-200 to-cyan-200', style: { top: '45%', left: '35%' }, x: [0, 40, 0], y: [0, -70, 0], scale: [1, 1.1, 1], duration: 22 },
] as const;

/** שכבת רקע: גרדיאנט עדין + כתמים צפים. `pointer-events-none`, מכבד prefers-reduced-motion. */
export function FloatingBlobs({ className, fixed = true }: { className?: string; fixed?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className={cn('pointer-events-none inset-0 -z-10 overflow-hidden', fixed ? 'fixed' : 'absolute', className)}>
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_100%_-10%,rgba(139,92,246,.10),transparent_60%),radial-gradient(900px_500px_at_0%_100%,rgba(56,189,248,.14),transparent_60%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)]" />
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className={cn('absolute size-[28rem] rounded-full bg-linear-to-br opacity-30 blur-3xl sm:size-[34rem]', b.className)}
          style={b.style}
          animate={reduce ? undefined : { x: [...b.x], y: [...b.y], scale: [...b.scale] }}
          transition={{ duration: b.duration, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="absolute inset-0 opacity-[.35] [background-image:radial-gradient(rgba(30,41,59,.08)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,.6),transparent_70%)]" />
    </div>
  );
}
