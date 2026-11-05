// Adapted from 21st.dev — Tilt Flip Card by cesaroeduardo. 3D flip (rotateY 180) + pointer tilt (±12deg) applied to the active side.
import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from './utils';

function mapRange(v: number, a: number, b: number, c: number, d: number) {
  return c + ((v - a) * (d - c)) / (b - a);
}

export interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  flipped: boolean;
  className?: string;
  /** להטיה לפי הסמן (עכבר בלבד) */
  tilt?: boolean;
  /** מחלקות לשני הצדדים */
  faceClassName?: string;
}

/**
 * FlipCard – מיכל תלת־ממדי (perspective + preserve-3d) עם שני צדדים; ההטיה נעשית ישירות ב־DOM (ללא state) דרך rAF.
 * האלמנט החיצוני אינו אינטראקטיבי – הכפתור עוטף אותו.
 */
export function FlipCard({ front, back, flipped, className, tilt = true, faceClassName }: FlipCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);

  const reset = useCallback(() => {
    if (frontRef.current) frontRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)';
    if (backRef.current) backRef.current.style.transform = 'rotateY(180deg)';
  }, []);

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!tilt || e.pointerType !== 'mouse' || frame.current !== null) return;
    const { clientX, clientY } = e;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const card = cardRef.current;
      const side = flipped ? backRef.current : frontRef.current;
      if (!card || !side) return;
      const r = card.getBoundingClientRect();
      const ry = mapRange(clientX - r.left, 0, r.width, -12, 12);
      const rx = mapRange(clientY - r.top, 0, r.height, 12, -12);
      side.style.transform = flipped ? `rotateY(180deg) rotateX(${rx}deg) rotateY(${ry}deg)` : `rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
  };

  return (
    <div ref={cardRef} onPointerMove={onMove} onPointerLeave={reset} className={cn('[perspective:1000px]', className)}>
      <div className={cn('relative h-full w-full transition-transform duration-500 ease-in-out [transform-style:preserve-3d]', flipped && '[transform:rotateY(180deg)]')}>
        <div ref={frontRef} className={cn('absolute inset-0 transition-transform duration-200 ease-out [backface-visibility:hidden]', faceClassName)}>
          {front}
        </div>
        <div ref={backRef} className={cn('absolute inset-0 transition-transform duration-200 ease-out [backface-visibility:hidden] [transform:rotateY(180deg)]', faceClassName)}>
          {back}
        </div>
      </div>
    </div>
  );
}
