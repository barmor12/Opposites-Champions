import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '@/hooks/useSound';
import { cn } from '@/lib/cn';

export interface SoundToggleProps {
  className?: string;
  showLabel?: boolean;
}

/** כפתור השתקה/הפעלת צלילים – משתמש ב־useSound (נשמר ב־localStorage) */
export function SoundToggle({ className, showLabel }: SoundToggleProps) {
  const { enabled, setEnabled, play } = useSound();
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (next) play('click');
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'השתקת צלילים' : 'הפעלת צלילים'}
      title={enabled ? 'השתקת צלילים' : 'הפעלת צלילים'}
      className={cn(
        'inline-flex min-h-12 min-w-12 items-center justify-center gap-2 rounded-full glass px-3 font-bold text-brand-navy transition-transform hover:-translate-y-0.5 active:translate-y-0',
        className,
      )}
    >
      {enabled ? <Volume2 className="size-6" aria-hidden /> : <VolumeX className="size-6 text-slate-400" aria-hidden />}
      {showLabel && <span className="text-sm">{enabled ? 'צלילים' : 'מושתק'}</span>}
    </button>
  );
}
