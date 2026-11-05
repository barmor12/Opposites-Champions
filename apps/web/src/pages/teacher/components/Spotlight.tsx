// מבוסס על 21st.dev — Spotlight Card (preetsuthar17): זרקור רדיאלי שעוקב אחרי העכבר בתוך כרטיס.
// מימוש ללא state: משתני CSS על האלמנט עצמו, כך שאין רינדור מחדש בכל תזוזה.
import type { MouseEvent } from 'react';
import { cn } from '@/lib/cn';

/** מאזינים להצמדה לאלמנט ה־`group relative overflow-hidden` שמכיל את ה־SpotlightOverlay. */
export function spotlightHandlers() {
  return {
    onMouseMove: (e: MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--sx', `${e.clientX - r.left}px`);
      el.style.setProperty('--sy', `${e.clientY - r.top}px`);
    },
  };
}

export function SpotlightOverlay({ color = 'rgba(139,92,246,.18)', size = 320, className }: { color?: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100', className)}
      style={{ background: `radial-gradient(${size}px circle at var(--sx, 50%) var(--sy, 50%), ${color}, transparent 70%)` }}
    />
  );
}
