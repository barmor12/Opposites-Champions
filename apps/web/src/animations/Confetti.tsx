import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

export interface ConfettiProps {
  /** כשהופך ל־true – נורה פרץ קונפטי */
  active: boolean;
  /** משך הפרץ במילישניות (ברירת מחדל 2500) */
  durationMs?: number;
  /** כמות חלקיקים (ברירת מחדל 140) */
  pieces?: number;
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  shape: 'rect' | 'circle' | 'star';
  wobble: number;
}

const COLORS = ['#38BDF8', '#8B5CF6', '#FACC15', '#F9A8D4', '#22C55E', '#FB923C', '#F43F5E'];

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Confetti – קנבס מלא-מסך (pointer-events: none) ללא תלויות.
 * מכבד prefers-reduced-motion (לא מצייר כלל).
 */
export function Confetti({ active, durationMs = 2500, pieces = 140 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width / dpr;
    const H = () => canvas.height / dpr;
    const parts: Piece[] = [];
    for (let i = 0; i < pieces; i++) {
      const fromLeft = i % 2 === 0;
      const angle = (fromLeft ? -Math.PI / 4 : -3 * Math.PI / 4) + (Math.random() - 0.5) * 0.8;
      const speed = 9 + Math.random() * 9;
      parts.push({
        x: fromLeft ? W() * 0.1 : W() * 0.9,
        y: H() * 0.75,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 10,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[i % COLORS.length] ?? '#FACC15',
        shape: i % 7 === 0 ? 'star' : i % 3 === 0 ? 'circle' : 'rect',
        wobble: Math.random() * Math.PI * 2,
      });
    }

    let raf = 0;
    const start = performance.now();
    let last = start;
    const step = (now: number) => {
      const dt = Math.min(2, (now - last) / 16.67);
      last = now;
      const elapsed = now - start;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W(), H());
      const fade = elapsed > durationMs - 500 ? Math.max(0, (durationMs - elapsed) / 500) : 1;
      for (const p of parts) {
        p.vy += 0.32 * dt; // gravity
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.wobble += 0.1 * dt;
        p.x += (p.vx + Math.sin(p.wobble) * 0.8) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.wobble)));
        } else if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          drawStar(ctx, p.w * 0.8);
        }
        ctx.restore();
      }
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, W(), H());
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      try {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W(), H());
      } catch {
        /* ignore */
      }
    };
  }, [active, durationMs, pieces, reduced]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="confetti"
      className="pointer-events-none fixed inset-0 z-[60] h-full w-full"
    />
  );
}

export default Confetti;
