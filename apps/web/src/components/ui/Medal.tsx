import { cn } from '@/lib/cn';
import { LazyImage } from './LazyImage';

import { MEDAL_SRC, type MedalKind } from '@/lib/assets';

export interface MedalProps {
  kind: MedalKind;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** ברק נע על המדליה (ברירת מחדל: כן) */
  shimmer?: boolean;
}

const EMOJI: Record<MedalKind, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const LABEL: Record<MedalKind, string> = { gold: 'מדליית זהב', silver: 'מדליית כסף', bronze: 'מדליית ארד' };
const SIZES = { sm: 'size-10 text-3xl', md: 'size-16 text-5xl', lg: 'size-24 text-7xl' };
const GLOW: Record<MedalKind, string> = {
  gold: 'drop-shadow-[0_6px_12px_rgba(245,158,11,0.55)]',
  silver: 'drop-shadow-[0_6px_12px_rgba(100,116,139,0.45)]',
  bronze: 'drop-shadow-[0_6px_12px_rgba(194,65,12,0.45)]',
};

/** מדליה עם ברק (shimmer) שנחתך לפי צורת המדליה (mask) */
export function Medal({ kind, size = 'md', className, shimmer = true }: MedalProps) {
  const src = MEDAL_SRC[kind];
  return (
    <span className={cn('relative inline-block shrink-0', SIZES[size], GLOW[kind], className)}>
      <LazyImage
        src={src}
        alt={LABEL[kind]}
        eager
        skeleton={false}
        wrapperClassName="size-full"
        className="size-full object-contain"
        fallback={<span className="leading-none">{EMOJI[kind]}</span>}
      />
      {shimmer && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})`, maskSize: 'contain', WebkitMaskSize: 'contain', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center' }}
        >
          <span className="absolute inset-y-0 -left-1/2 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/90 to-transparent" />
        </span>
      )}
    </span>
  );
}
