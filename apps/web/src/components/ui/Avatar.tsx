import { AVATAR_LABELS, type AvatarId } from '@oc/shared';
import { cn } from '@/lib/cn';
import { AVATAR_EMOJI, AVATAR_TINT } from '@/lib/avatarEmoji';
import { LazyImage } from './LazyImage';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps {
  id: AvatarId;
  size?: AvatarSize;
  ring?: boolean;
  className?: string;
  /** שם נגיש חלופי (ברירת מחדל: שם הדמות) */
  alt?: string;
}

const SIZES: Record<AvatarSize, { box: string; emoji: string }> = {
  xs: { box: 'size-8', emoji: 'text-lg' },
  sm: { box: 'size-10', emoji: 'text-xl' },
  md: { box: 'size-14', emoji: 'text-3xl' },
  lg: { box: 'size-20', emoji: 'text-4xl' },
  xl: { box: 'size-28', emoji: 'text-6xl' },
  '2xl': { box: 'size-36', emoji: 'text-7xl' },
};

export function avatarSrc(id: AvatarId): string {
  return `/avatars/${id}.svg`;
}

/** דמות משתמש – SVG מתוך /avatars עם אימוג׳י גיבוי */
export function Avatar({ id, size = 'md', ring, className, alt }: AvatarProps) {
  const s = SIZES[size];
  const label = alt ?? AVATAR_LABELS[id];
  return (
    <LazyImage
      src={avatarSrc(id)}
      alt={label}
      wrapperClassName={cn(
        'rounded-full shrink-0 shadow-sm',
        s.box,
        ring && 'ring-4 ring-white shadow-card',
        className,
      )}
      className="size-full object-cover rounded-full"
      style={{ backgroundColor: AVATAR_TINT[id] }}
      fallback={
        <span
          className={cn('flex size-full items-center justify-center rounded-full', s.emoji)}
          style={{ backgroundColor: AVATAR_TINT[id] }}
        >
          {AVATAR_EMOJI[id]}
        </span>
      }
    />
  );
}
