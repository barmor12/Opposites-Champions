import { useEffect, useRef } from 'react';
import { animate } from 'motion/react';

export type ParticleShape = 'circle' | 'rect' | 'strip' | 'star';
export interface Particle {
  keyframes: { transform: string[]; opacity: number[] };
  duration: number;
  size: number;
  color: string;
  shape: ParticleShape;
}

export function ParticleDot({ particle }: { particle: Particle }) {
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

