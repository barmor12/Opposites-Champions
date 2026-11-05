import { cn } from '@/lib/cn';
import { LazyImage } from './LazyImage';

import { MEDAL_SRC, type MedalKind } from '@/lib/assets';

export interface MedalProps {
  kind: MedalKind;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const EMOJI: Record<MedalKind, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const LABEL: Record<MedalKind, string> = { gold: 'מדליית זהב', silver: 'מדליית כסף', bronze: 'מדליית ארד' };
const SIZES = { sm: 'size-10 text-3xl', md: 'size-16 text-5xl', lg: 'size-24 text-7xl' };

export function Medal({ kind, size = 'md', className }: MedalProps) {
  return (
    <LazyImage
      src={MEDAL_SRC[kind]}
      alt={LABEL[kind]}
      eager
      skeleton={false}
      wrapperClassName={cn('drop-shadow-md', SIZES[size], className)}
      className="size-full object-contain"
      fallback={<span className="leading-none">{EMOJI[kind]}</span>}
    />
  );
}
