import { cn } from '@/lib/cn';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

const SIZES = { sm: 'size-5 border-[3px]', md: 'size-9 border-4', lg: 'size-14 border-[6px]' };

export function Spinner({ size = 'md', label = 'טוען…', className }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn('inline-block rounded-full border-current border-t-transparent animate-spin', SIZES[size], className)}
    />
  );
}
