// Adapted from 21st.dev — Confetti by motion.dev. Particle explosion with randomised physics using motion's `animate` on DOM nodes (no canvas).
import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';

const COLORS = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff', '#facc15'];
const SHAPES = ['circle', 'rect', 'rect', 'strip', 'strip', 'star'] as const;
const KEYFRAME_COUNT = 40;
const POP_WINDOW = 0.08;

type ParticleShape = (typeof SHAPES)[number];
interface Particle {
  keyframes: { transform: string[]; opacity: number[] };
  duration: number;
  size: number;
  color: string;
  shape: ParticleShape;
}
interface Burst {
  id: number;
  particles: Particle[];
  x: number;
  y: number;
}

function buildKeyframes(p: {
  angle: number; startVelocity: number; decay: number; gravity: number; drift: number;
  wobbleSpeed: number; wobbleOffset: number; size: number; ticks: number; tiltRotations: number; rotation: number;
}) {
  const transforms: string[] = [];
  const opacities: number[] = [];
  let velocity = p.startVelocity;
  let x = 0;
  let y = 0;
  let wobble = p.wobbleOffset;
  let tick = 0;
  for (let i = 0; i <= KEYFRAME_COUNT; i++) {
    const t = i / KEYFRAME_COUNT;
    if (i > 0) {
      const targetTick = Math.round((i * p.ticks) / KEYFRAME_COUNT);
      while (tick < targetTick) {
        x += Math.cos(p.angle) * velocity + p.drift;
        y += Math.sin(p.angle) * velocity + p.gravity * 3;
        velocity *= p.decay;
        wobble += p.wobbleSpeed;
        tick++;
      }
    }
    const translateX = i === 0 ? 0 : x + Math.cos(wobble) * 15 * p.size;
    let scale: number;
    if (t < POP_WINDOW * 0.6) scale = (t / (POP_WINDOW * 0.6)) * 1.15;
    else if (t < POP_WINDOW) scale = 1.15 - ((t - POP_WINDOW * 0.6) / (POP_WINDOW * 0.4)) * 0.15;
    else scale = 1;
    const tilt = p.tiltRotations * 360 * t;
    const opacity = t <= 0.5 ? 1 : t <= 0.8 ? 1 - ((t - 0.5) / 0.3) * 0.5 : 0.5 - ((t - 0.8) / 0.2) * 0.5;
    transforms.push(`translate(${translateX}px, ${y}px) scale(${scale}) rotateY(${tilt}deg) rotate(${p.rotation}deg)`);
    opacities.push(opacity);
  }
  return { transform: transforms, opacity: opacities };
}

function ParticleDot({ particle }: { particle: Particle }) {
  const ref = useRef<HTMLDivElement>(null);
  const { keyframes, duration, size, color, shape } = particle;
  const width = shape === 'strip' ? size * 0.35 : shape === 'rect' ? size * 0.75 : size;
  const height = shape === 'strip' ? size * 2 : size;
  const radius = shape === 'circle' ? '50%' : shape === 'strip' ? size * 0.12 : 2;
  useEffect(() => {
    if (!ref.current) return;
    const controls = animate(ref.current, keyframes, { duration, ease: 'linear' });
    return () => controls.cancel();
  }, [keyframes, duration]);
  const style: React.CSSProperties = {
    position: 'absolute',
    width,
    height,
    borderRadius: radius,
    backgroundColor: color,
    willChange: 'transform, opacity',
    pointerEvents: 'none',
    clipPath: shape === 'star' ? 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' : undefined,
  };
  return <div ref={ref} style={style} />;
}

export interface ConfettiBurstOptions {
  particleCount?: number;
  startVelocity?: number;
  spread?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  duration?: number;
  size?: number;
}

/**
 * useConfettiBursts – פרץ קונפטי "פיזיקלי" (DOM, ללא canvas).
 * מחזיר [node, fire]. יש למקם את node בתוך אלמנט relative/overflow-visible.
 * fire(x?, y?) – מיקום באחוזים (ברירת מחדל: מרכז).
 */
export function useConfettiBursts({ particleCount = 70, startVelocity = 26, spread = 110, decay = 0.9, gravity = 1, drift = 0, duration = 2.4, size = 1 }: ConfettiBurstOptions = {}) {
  const reduce = useReducedMotion();
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);

  const fire = useCallback(
    (x = 50, y = 50) => {
      if (reduce) return;
      const id = nextId.current++;
      const ticks = Math.round(duration * 60);
      const particles: Particle[] = Array.from({ length: particleCount }, () => {
        const spreadRad = spread * (Math.PI / 180);
        const angle = -Math.PI / 2 + (0.5 * spreadRad - Math.random() * spreadRad);
        const velocity = startVelocity * 0.5 + Math.random() * startVelocity;
        return {
          keyframes: buildKeyframes({
            angle, startVelocity: velocity, decay, gravity, drift,
            wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05), wobbleOffset: Math.random() * 10,
            size, ticks, tiltRotations: 2 + Math.random() * 4, rotation: Math.random() * 360,
          }),
          duration,
          size: 6 * size + Math.random() * 6 * size,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
          shape: SHAPES[Math.floor(Math.random() * SHAPES.length)]!,
        };
      });
      setBursts((c) => [...c, { id, particles, x, y }]);
      window.setTimeout(() => setBursts((c) => c.filter((b) => b.id !== id)), (duration + 0.5) * 1000);
    },
    [reduce, particleCount, startVelocity, spread, decay, gravity, drift, duration, size],
  );

  const node = (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-visible" data-testid="confetti-burst">
      {bursts.map((b) => (
        <div key={b.id} className="absolute" style={{ left: `${b.x}%`, top: `${b.y}%` }}>
          {b.particles.map((p, i) => (
            <ParticleDot key={i} particle={p} />
          ))}
        </div>
      ))}
    </div>
  );
  return [node, fire] as const;
}

