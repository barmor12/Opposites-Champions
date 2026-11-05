import { AVATAR_LABELS, type AvatarId } from '@oc/shared';
import { cn } from '@/lib/cn';
import { AVATAR_EMOJI, AVATAR_TINT } from '@/lib/avatarEmoji';
import { avatarSrc } from '@/lib/assets';
import { LazyImage } from './LazyImage';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps {
  id: AvatarId;
  size?: AvatarSize;
  /** טבעת גרדיאנט זוהרת סביב הדמות */
  ring?: boolean;
  /** צבע הטבעת */
  ringColor?: 'white' | 'violet' | 'gold' | 'rainbow';
  /** הילה רכה מאחורי הדמות */
  glow?: boolean;
  className?: string;
  /** שם נגיש חלופי (ברירת מחדל: שם הדמות) */
  alt?: string;
}

const SIZES: Record<AvatarSize, { box: string; emoji: string; pad: string }> = {
  xs: { box: 'size-8', emoji: 'text-lg', pad: 'p-[2px]' },
  sm: { box: 'size-10', emoji: 'text-xl', pad: 'p-[2px]' },
  md: { box: 'size-14', emoji: 'text-3xl', pad: 'p-[3px]' },
  lg: { box: 'size-20', emoji: 'text-4xl', pad: 'p-[3px]' },
  xl: { box: 'size-28', emoji: 'text-6xl', pad: 'p-1' },
  '2xl': { box: 'size-36', emoji: 'text-7xl', pad: 'p-1' },
};

const RINGS = {
  white: 'bg-gradient-to-b from-white to-slate-200 shadow-[0_6px_16px_-6px_rgba(30,41,59,0.35)]',
  violet: 'bg-gradient-to-br from-violet-300 via-brand-violet to-indigo-600 shadow-glow-violet',
  gold: 'bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-glow-gold',
  rainbow: 'bg-[conic-gradient(from_90deg,#f87171,#fb923c,#facc15,#4ade80,#38bdf8,#8b5cf6,#f87171)] shadow-[0_8px_20px_-6px_rgba(139,92,246,0.5)]',
};

/** דמות משתמש – SVG מתוך /avatars עם אימוג׳י גיבוי, טבעת זוהרת והילה */
export function Avatar({ id, size = 'md', ring, ringColor = 'white', glow, className, alt }: AvatarProps) {
  const s = SIZES[size];
  const label = alt ?? AVATAR_LABELS[id];
  const image = (
    <LazyImage
      src={avatarSrc(id)}
      alt={label}
      wrapperClassName={cn('rounded-full shrink-0 shadow-[inset_0_-3px_6px_rgba(30,41,59,0.12)]', ring ? 'size-full' : s.box, !ring && className)}
      className="size-full object-cover rounded-full"
      style={{ backgroundColor: AVATAR_TINT[id] }}
      fallback={
        <span className={cn('flex size-full items-center justify-center rounded-full', s.emoji)} style={{ backgroundColor: AVATAR_TINT[id] }}>
          {AVATAR_EMOJI[id]}
        </span>
      }
    />
  );
  if (!ring && !glow) return image;
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full', s.box, className)}>
      {glow && <span aria-hidden className="absolute -inset-[18%] rounded-full bg-white/60 blur-xl" style={{ backgroundColor: AVATAR_TINT[id] }} />}
      <span className={cn('relative size-full rounded-full', ring && s.pad, ring && RINGS[ringColor])}>
        <span className="block size-full rounded-full bg-white p-[2px]">{image}</span>
      </span>
    </span>
  );
}
