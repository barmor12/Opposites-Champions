type ClassValue = string | number | bigint | null | false | undefined | Record<string, boolean | null | undefined> | ClassValue[];

/** מאחד מחלקות CSS בצורה בטוחה (clsx מינימלי ללא תלות) */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else for (const [k, on] of Object.entries(v)) if (on) out.push(k);
  };
  inputs.forEach(walk);
  return out.join(' ');
}
