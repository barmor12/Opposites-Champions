/** מחולל מספרים אקראיים דטרמיניסטי (mulberry32) – לשחזור יצירת שאלות בבדיקות */
export type Rng = () => number;

export function hashSeed(seed: string | number): number {
  const str = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seededRng(seed: string | number): Rng {
  let a = hashSeed(seed) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pick from empty array');
  return items[Math.floor(rng() * items.length)] as T;
}

/** מזהה אקראי קצר (ללא מבנה שחושף זיווג) */
export function randomId(rng: Rng, length = 10): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(rng() * alphabet.length)];
  return out;
}
