import { Sparkles } from 'lucide-react';
import { DEMO_ROOMS } from './engine';
import { cn } from '@/lib/cn';

/** קודי החדרים של הדמו – לחיצה ממלאת את שדה הקוד */
export function DemoCodes({ value, onPick }: { value: string; onPick: (code: string) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-b from-violet-50 to-sky-50 p-3 ring-1 ring-violet-200/70">
      <p className="flex items-center gap-1.5 text-sm font-bold text-violet-800">
        <Sparkles className="size-4" aria-hidden /> גִּרְסַת דָּמוֹ – בַּחֲרוּ חֶדֶר (אֵין צוֹרֶךְ בְּמוֹרֵה):
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label="חַדְרֵי דָּמוֹ">
        {DEMO_ROOMS.map((room) => {
          const active = value === room.code;
          return (
            <button
              key={room.code}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(room.code)}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-2 py-2 text-center transition-all',
                active ? 'border-violet-500 bg-white shadow-pop -translate-y-0.5' : 'border-white/70 bg-white/70 hover:-translate-y-0.5 hover:bg-white',
              )}
            >
              <span dir="ltr" className="text-lg font-black tabular-nums tracking-[0.25em] text-brand-navy">
                {room.code}
              </span>
              <span className="text-xs font-bold text-slate-600">{room.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
