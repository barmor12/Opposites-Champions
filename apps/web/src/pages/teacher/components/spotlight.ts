import type { MouseEvent } from 'react';

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
