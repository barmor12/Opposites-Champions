import { useEffect, type KeyboardEvent, type RefObject } from 'react';

/**
 * מרחיב את שטח הלחיצה של פקד קטן ל־44px לפחות (WCAG 2.5.5) בלי לשנות את גודלו הנראה.
 * מוסיף ::after שקוף ממוקם מסביב לפקד – דורש שהפקד לא יהיה `overflow-hidden`.
 */
export const HIT_AREA = {
  /** פקד בגובה 32px (size-8) */
  sm: 'relative after:absolute after:-inset-1.5 after:content-[""]',
  /** פקד בגובה 36px (size-9) */
  md: 'relative after:absolute after:-inset-1 after:content-[""]',
  /** פקד בגובה 40px (size-10) */
  lg: 'relative after:absolute after:-inset-0.5 after:content-[""]',
  /** הרחבה אנכית בלבד – לצ׳יפים/טאבים (24px → 44px) */
  y10: 'relative after:absolute after:inset-x-0 after:-inset-y-2.5 after:content-[""]',
  /** 28px → 44px */
  y8: 'relative after:absolute after:inset-x-0 after:-inset-y-2 after:content-[""]',
  /** 32px → 44px */
  y6: 'relative after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[""]',
  /** 36px → 44px */
  y4: 'relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[""]',
  /** 40px → 44px */
  y2: 'relative after:absolute after:inset-x-0 after:-inset-y-0.5 after:content-[""]',
} as const;

/**
 * כפתור ה־UI המשותף (`Button`) מגדיר `outline-none` ובכך מבטל את טבעת הפוקוס הגלובלית.
 * המחלקה הזו, על עטיפה של העמוד, מחזירה טבעת פוקוס נראית לכל `button.isolate` (Button/MagicButton) בתוכה.
 */
export const BUTTON_FOCUS_RING = '[&_button.isolate:focus-visible]:outline-4 [&_button.isolate:focus-visible]:outline-offset-[3px] [&_button.isolate:focus-visible]:outline-brand-violet';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
}

export interface FocusTrapOptions {
  /** האם להעביר את הפוקוס פנימה בפתיחה (ברירת מחדל: כן) */
  initialFocus?: boolean;
  /** האם להחזיר את הפוקוס לאלמנט שהיה פעיל לפני הפתיחה (ברירת מחדל: כן) */
  returnFocus?: boolean;
  /** סלקטור למכולה האמיתית (למשל `[role="dialog"]` של ה־Modal המשותף) – ברירת מחדל: האלמנט עצמו */
  containerSelector?: string;
}

/**
 * לכידת פוקוס (focus trap) בתוך דיאלוג/מגירה: Tab/Shift+Tab מסתובבים בתוך המכולה,
 * הפוקוס עובר פנימה בפתיחה וחוזר למקור בסגירה.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, { initialFocus = true, returnFocus = true, containerSelector }: FocusTrapOptions = {}): void {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const container = (containerSelector ? el.closest<HTMLElement>(containerSelector) : null) ?? el;
    const previous = document.activeElement as HTMLElement | null;

    if (initialFocus && !container.contains(document.activeElement)) {
      const first = focusables(container)[0];
      (first ?? container).focus({ preventScroll: true });
    }

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const list = focusables(container);
      if (list.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const current = document.activeElement as HTMLElement | null;
      const inside = current ? container.contains(current) : false;
      if (e.shiftKey && (current === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (returnFocus && previous && previous.isConnected && typeof previous.focus === 'function') previous.focus({ preventScroll: true });
    };
  }, [ref, active, initialFocus, returnFocus, containerSelector]);
}

/**
 * ניווט במקשי חצים בקבוצת radio מותאמת (צ׳יפים, כרטיסי מצב, טאבים מקוטעים):
 * חץ ימינה/שמאלה לפי כיוון הכתיבה, למעלה/למטה – ובחירה של הפריט שהפוקוס עובר אליו (כמו radio מקורי).
 */
export function radioGroupKeyDown(e: KeyboardEvent<HTMLElement>, itemSelector = '[role="radio"]:not([disabled])'): void {
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const group = e.currentTarget;
  const items = [...group.querySelectorAll<HTMLElement>(itemSelector)];
  if (items.length === 0) return;
  const idx = items.indexOf(document.activeElement as HTMLElement);
  const rtl = getComputedStyle(group).direction === 'rtl';
  const forward = e.key === 'ArrowDown' || (rtl ? e.key === 'ArrowLeft' : e.key === 'ArrowRight');
  let next: number;
  if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = items.length - 1;
  else if (idx === -1) next = 0;
  else next = (idx + (forward ? 1 : -1) + items.length) % items.length;
  e.preventDefault();
  const target = items[next];
  if (!target) return;
  target.focus();
  target.click();
}
