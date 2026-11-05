import { UI_IMAGES } from '@/lib/assets';
import { LazyImage } from './_ui';

/** איור SVG מובנה של תיבת אוצר – משמש כגיבוי כשקובץ ה־SVG החיצוני אינו זמין */
export function ChestSvg({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 120 110" className={className} aria-hidden="true">
      {open && (
        <g>
          <circle cx="60" cy="40" r="34" fill="#FACC15" opacity="0.25" />
          <circle cx="60" cy="40" r="22" fill="#FDE68A" opacity="0.5" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <ellipse key={i} cx={38 + i * 9} cy={48 - (i % 2) * 6} rx="7" ry="5" fill="#FBBF24" stroke="#B45309" strokeWidth="1.5" />
          ))}
          <path d="M60 14 l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#FDE047" stroke="#CA8A04" />
        </g>
      )}
      {/* lid */}
      <g transform={open ? 'rotate(-38 18 52)' : undefined}>
        <path d="M18 52 Q18 24 60 24 Q102 24 102 52 Z" fill="#B45309" stroke="#78350F" strokeWidth="3" />
        <path d="M30 52 Q30 32 60 32 Q90 32 90 52 Z" fill="#D97706" opacity="0.8" />
        <rect x="18" y="48" width="84" height="8" rx="2" fill="#FBBF24" stroke="#92400E" strokeWidth="2" />
      </g>
      {/* box */}
      <rect x="18" y="52" width="84" height="46" rx="6" fill="#92400E" stroke="#78350F" strokeWidth="3" />
      <rect x="18" y="62" width="84" height="7" fill="#FBBF24" stroke="#92400E" strokeWidth="1.5" />
      <rect x="18" y="82" width="84" height="7" fill="#FBBF24" stroke="#92400E" strokeWidth="1.5" />
      <rect x="51" y="58" width="18" height="18" rx="4" fill="#FDE047" stroke="#A16207" strokeWidth="2" />
      <circle cx="60" cy="66" r="3" fill="#78350F" />
      <rect x="58.5" y="66" width="3" height="5" fill="#78350F" />
    </svg>
  );
}

export function TreasureChestImage({ open, className }: { open: boolean; className?: string }) {
  const src = open ? UI_IMAGES.treasureOpen : UI_IMAGES.treasureClosed;
  return (
    <LazyImage
      src={src}
      alt={open ? 'תיבת אוצר פתוחה' : 'תיבת אוצר סגורה'}
      className={className}
      fallback={<ChestSvg open={open} className="h-full w-full" />}
    />
  );
}
