import { cn } from '@/lib/cn';
import { LazyImage } from './LazyImage';

export type MedalKind = 'gold' | 'silver' | 'bronze';
export interface MedalProps {
  kind: MedalKind;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SRC: Record<MedalKind, string> = {
  gold: '/images/ui/medal-gold.svg',
  silver: '/images/ui/medal-silver.svg',
  bronze: '/images/ui/medal-bronze.svg',
};
const EMOJI: Record<MedalKind, string> = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const LABEL: Record<MedalKind, string> = { gold: 'מדליית זהב', silver: 'מדליית כסף', bronze: 'מדליית ארד' };
const SIZES = { sm: 'size-10 text-3xl', md: 'size-16 text-5xl', lg: 'size-24 text-7xl' };

export function medalForRank(rank: number): MedalKind | null {
  return rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : null;
}

export function Medal({ kind, size = 'md', className }: MedalProps) {
  return (
    <LazyImage
      src={SRC[kind]}
      alt={LABEL[kind]}
      eager
      skeleton={false}
      wrapperClassName={cn('drop-shadow-md', SIZES[size], className)}
      className="size-full object-contain"
      fallback={<span className="leading-none">{EMOJI[kind]}</span>}
    />
  );
}
