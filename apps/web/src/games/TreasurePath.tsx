import { motion, useReducedMotion } from 'motion/react';
import { Check, Star } from 'lucide-react';
import { TREASURE_QUESTIONS } from '@oc/shared';
import { cn } from './utils';
import { TreasureChestImage } from './TreasureChest';

export interface TreasurePathProps {
  step: number; // 1..total
  total?: number;
  completed?: boolean; // כל השלבים הושלמו
}

interface Point {
  x: number; // 0..100 (%)
  y: number; // 0..100 (%)
}

/** נקודות המסלול – מימין (התחלה, RTL) לשמאל (התיבה), בצורת נחש */
function pathPoints(total: number): { steps: Point[]; chest: Point } {
  const startX = 92;
  const endX = 14;
  const steps: Point[] = Array.from({ length: total }, (_, i) => {
    const t = total === 1 ? 0 : i / total;
    return { x: startX - t * (startX - endX), y: i % 2 === 0 ? 40 : 72 };
  });
  return { steps, chest: { x: 6, y: 56 } };
}

function roadD(pts: Point[], chest: Point): string {
  const all = [...pts, chest];
  if (all.length < 2) return '';
  let d = `M ${all[0]!.x} ${all[0]!.y}`;
  for (let i = 1; i < all.length; i++) {
    const p0 = all[i - 1]!;
    const p1 = all[i]!;
    const cx = (p0.x + p1.x) / 2;
    d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

/** מסלול האוצר – דרך תלת־ממדית מתפתלת עם תחנות זוהרות, סמן השחקן ותיבת אוצר בסוף */
export function TreasurePath({ step, total = TREASURE_QUESTIONS, completed = false }: TreasurePathProps) {
  const reduced = useReducedMotion();
  const safeStep = Math.min(Math.max(1, step), total);
  const { steps, chest } = pathPoints(total);
  const d = roadD(steps, chest);
  const doneCount = completed ? total : safeStep - 1;
  const litD = roadD(steps.slice(0, Math.max(1, doneCount + (completed ? 1 : 0))), completed ? chest : steps[Math.min(total - 1, Math.max(0, doneCount))]!);

  return (
    <section
      aria-label={`אֶתְגַּר הָאוֹצָר – שָׁלָב ${safeStep} מִתּוֹךְ ${total}`}
      data-testid="treasure-path"
      className={cn(
        'relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-amber-100 via-yellow-50 to-orange-100 px-4 pb-3 pt-3 ring-1 ring-amber-200',
        'shadow-[0_18px_40px_-18px_rgba(180,83,9,0.45),inset_0_2px_0_#fff,inset_0_-5px_0_rgba(180,83,9,0.08)]',
      )}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -end-10 -top-12 size-40 rounded-full bg-gradient-to-br from-yellow-200/80 to-transparent blur-2xl" />
      <div className="relative mb-1 flex items-center justify-between gap-2">
        <h2 className="text-base font-black text-amber-900 sm:text-xl">
          <span aria-hidden="true">🗺️ </span>
          אֶתְגַּר הָאוֹצָר – שָׁלָב {safeStep} מִתּוֹךְ {total}
        </h2>
        <span className="hidden whitespace-nowrap rounded-full bg-gradient-to-b from-amber-200 to-amber-300 px-3 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-amber-400/60 shadow-[inset_0_1px_0_#fff] sm:inline-block sm:text-sm">
          {completed ? 'הוּשְׁלַם!' : 'עָנוּ נָכוֹן כְּדֵי לְהִתְקַדֵּם'}
        </span>
      </div>

      <div className="relative mt-1 h-[6.5rem] w-full sm:h-32" dir="ltr">
        {/* הַדֶּרֶךְ */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="road-lit" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fde047" />
              <stop offset="1" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          {/* צֵל הַדֶּרֶךְ */}
          <path d={d} fill="none" stroke="#92400e" strokeOpacity="0.22" strokeWidth={22} strokeLinecap="round" vectorEffect="non-scaling-stroke" transform="translate(0 2.2)" />
          {/* קָצֶה כֵּהֶה */}
          <path d={d} fill="none" stroke="#b45309" strokeWidth={20} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {/* פְּנֵי הַדֶּרֶךְ */}
          <path d={d} fill="none" stroke="#fbbf24" strokeWidth={14} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {/* גְּלוֹס */}
          <path d={d} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" transform="translate(0 -1.6)" />
          {/* קַו מְקֻוְוקָו */}
          <path d={d} fill="none" stroke="#fff7ed" strokeOpacity="0.8" strokeWidth={2} strokeDasharray="6 7" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {/* קֶטַע שֶׁהוּשְׁלַם – זוֹהַר */}
          {doneCount > 0 && (
            <path d={litD} fill="none" stroke="url(#road-lit)" strokeWidth={14} strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: 'drop-shadow(0 0 6px rgba(250,204,21,0.9))' }} />
          )}
        </svg>

        {/* תַּחֲנוֹת */}
        <ol className="absolute inset-0 m-0 list-none p-0" dir="rtl">
          {steps.map((p, i) => {
            const n = i + 1;
            const done = completed || n < safeStep;
            const current = !completed && n === safeStep;
            return (
              <li key={n} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <div className="relative flex flex-col items-center">
                  <motion.div
                    initial={false}
                    animate={done ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                    transition={{ duration: 0.5 }}
                    className={cn(
                      'relative flex h-9 w-9 items-center justify-center rounded-full border-b-4 text-sm font-black sm:h-11 sm:w-11 sm:text-base',
                      'shadow-[inset_0_2px_0_rgba(255,255,255,0.7)]',
                      done && 'border-amber-600 bg-gradient-to-b from-yellow-200 to-amber-400 text-amber-900 shadow-[0_0_18px_4px_rgba(250,204,21,0.65),inset_0_2px_0_rgba(255,255,255,0.8)]',
                      current && 'border-pink-600 bg-gradient-to-b from-white to-pink-100 text-pink-600 ring-4 ring-pink-300/70',
                      !done && !current && 'border-amber-400 bg-gradient-to-b from-amber-50 to-amber-200 text-amber-500',
                    )}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`שָׁלָב ${n}${done ? ' – הוּשְׁלַם' : current ? ' – נוֹכְחִי' : ''}`}
                  >
                    {done ? <Check className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={3.5} /> : current ? n : <Star className="h-4 w-4 sm:h-5 sm:w-5" />}
                  </motion.div>
                  {current && (
                    <motion.div
                      aria-hidden="true"
                      data-testid="treasure-marker"
                      className="absolute -top-8 text-2xl leading-none drop-shadow-[0_6px_6px_rgba(30,41,59,0.3)] sm:-top-9 sm:text-3xl"
                      animate={reduced ? undefined : { y: [0, -6, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      🧑‍🚀
                    </motion.div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* תֵּיבַת הָאוֹצָר */}
        <motion.div
          className="absolute h-16 w-20 -translate-x-1/2 -translate-y-1/2 sm:h-20 sm:w-24"
          style={{ left: `${chest.x + 4}%`, top: `${chest.y - 6}%` }}
          animate={reduced ? undefined : completed ? { scale: [1, 1.1, 1] } : { rotate: [0, -4, 4, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 }}
        >
          <span aria-hidden="true" className={cn('absolute inset-[10%] rounded-full bg-yellow-300/70 blur-xl', !reduced && 'animate-glow-gold')} />
          <TreasureChestImage open={completed} className="relative h-full w-full drop-shadow-[0_8px_10px_rgba(120,53,15,0.4)]" />
        </motion.div>
      </div>
    </section>
  );
}
