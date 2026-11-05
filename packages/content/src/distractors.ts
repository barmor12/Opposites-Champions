import type { Category, WordPairContent } from '@oc/shared';

/**
 * קבוצות מילים נרדפות / צורות שונות של אותו מושג.
 * מילה מאותה קבוצה כמו התשובה הנכונה לעולם לא תוצע כמסיח, כדי שלא יהיו שתי תשובות "נכונות".
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ['גדול', 'ענק', 'מגדיל', 'עצום'],
  ['קטן', 'זעיר', 'מקטין', 'קטנטן'],
  ['מהיר', 'זריז', 'מהר', 'מאיץ', 'ממהר'],
  ['איטי', 'לאט', 'מאט', 'מתעכב'],
  ['שמח', 'עליז', 'מאושר', 'שמחה', 'מרוצה'],
  ['עצוב', 'עגום', 'אומלל', 'עצב', 'מאוכזב'],
  ['חם', 'לוהט', 'רותח', 'חמים', 'מתחמם', 'אש'],
  ['קר', 'קפוא', 'קריר', 'מתקרר', 'קרח', 'מקפיא'],
  ['ישן', 'עתיק', 'מיושן'],
  ['חדש', 'טרי', 'מודרני'],
  ['אמיץ', 'גיבור', 'אומץ'],
  ['פחדן', 'מפוחד', 'פחד'],
  ['רגוע', 'שליו', 'נינוח'],
  ['לחוץ', 'מתוח', 'מודאג'],
  ['יפה', 'נאה', 'יופי'],
  ['מכוער', 'כיעור'],
  ['חכם', 'נבון', 'חוכמה'],
  ['טיפש', 'שוטה', 'טיפשות'],
  ['עייף', 'תשוש'],
  ['רועש', 'קולני', 'רעש'],
  ['שקט', 'דממה', 'שותק'],
  ['מלוכלך', 'מטונף', 'מלכלך'],
  ['נקי', 'מנקה'],
  ['חזק', 'כוח'],
  ['חלש', 'חולשה', 'רפוי'],
  ['עשיר', 'עושר'],
  ['עני', 'עוני'],
  ['בריא', 'בריאות'],
  ['חולה', 'מחלה'],
  ['מואר', 'בהיר', 'זוהר', 'מבריק', 'מאיר', 'אור'],
  ['חשוך', 'כהה', 'אפל', 'מחשיך', 'חושך', 'עמום'],
  ['דולק', 'נדלק', 'מדליק'],
  ['כבוי', 'נכבה', 'מכבה'],
  ['פותח', 'פתוח'],
  ['סוגר', 'סגור', 'נעול'],
  ['מלא', 'ממלא'],
  ['ריק', 'מרוקן'],
  ['עולה', 'עלייה', 'מרים'],
  ['יורד', 'ירידה', 'מוריד'],
  ['זוכר', 'זיכרון'],
  ['שוכח', 'שכחה'],
  ['מנצח', 'ניצחון', 'מצליח', 'הצלחה'],
  ['מפסיד', 'הפסד', 'נכשל', 'כישלון'],
  ['בונה', 'בנייה'],
  ['הורס', 'הריסה'],
  ['אוהב', 'אהבה', 'ידידות', 'חבר'],
  ['שונא', 'שנאה', 'איבה', 'אויב'],
  ['נכנס', 'כניסה', 'מכניס'],
  ['יוצא', 'יציאה', 'מוציא'],
  ['חוסך', 'חיסכון'],
  ['מבזבז', 'בזבוז'],
  ['יבש', 'מתייבש'],
  ['רטוב', 'נרטב'],
  ['מתחיל', 'התחלה', 'ראשון'],
  ['מסיים', 'סוף', 'אחרון'],
  ['מאחר', 'מאוחר'],
  ['מקדים', 'מוקדם'],
  ['קרוב', 'מתקרב'],
  ['רחוק', 'מתרחק'],
  ['מסודר', 'סדר'],
  ['מבולגן', 'בלגן'],
  ['קשה', 'קשיח', 'מוצק'],
  ['רך', 'גמיש', 'עדין'],
  ['מחוספס', 'גס'],
  ['חלק', 'ישר'],
  ['הרבה', 'יותר', 'שפע', 'רוב', 'מקסימום'],
  ['מעט', 'פחות', 'מחסור', 'מיעוט', 'מינימום'],
  ['למעלה', 'מעל', 'עליון', 'פסגה', 'תקרה', 'צמרת', 'שמיים'],
  ['למטה', 'מתחת', 'תחתון', 'תחתית', 'רצפה', 'שורש', 'אדמה'],
  ['בפנים', 'פנימי'],
  ['בחוץ', 'חיצוני'],
  ['קדימה', 'קדמי'],
  ['אחורה', 'אחורי'],
  ['מותר', 'מרשה', 'רשות', 'הסכמה', 'מסכים', 'מאשר', 'תמיכה'],
  ['אסור', 'אוסר', 'סירוב', 'מתנגד', 'דוחה', 'התנגדות', 'חובה'],
  ['נכון', 'אמת', 'אמיתי', 'מקורי', 'טבעי'],
  ['שגוי', 'שקר', 'מזויף', 'חיקוי', 'מלאכותי'],
  ['נותן', 'שולח', 'מוכר', 'הוצאה', 'ייצוא'],
  ['לוקח', 'מקבל', 'קונה', 'הכנסה', 'ייבוא'],
  ['מחבר', 'אחדות'],
  ['מפריד', 'פירוד'],
  ['גלוי', 'חשוף'],
  ['נסתר', 'מכוסה'],
  ['שלם', 'עמיד'],
  ['שבור', 'שביר'],
  ['טוב', 'תועלת', 'חיובי'],
  ['רע', 'נזק', 'שלילי'],
  ['צהריים', 'יום', 'בוקר', 'זריחה'],
  ['חצות', 'לילה', 'ערב', 'שקיעה'],
  ['בטוח', 'זהיר', 'בוטח'],
  ['מסוכן', 'פזיז', 'חושד'],
  ['נלהב', 'מתעניין'],
  ['אדיש', 'משועמם'],
  ['חופשי', 'פנוי', 'עצמאי'],
  ['כלוא', 'עסוק', 'תלוי'],
  ['נדיר', 'מיוחד'],
  ['נפוץ', 'רגיל'],
  ['פשוט', 'ברור', 'קל'],
  ['מורכב', 'מעורפל', 'קשה'],
  ['קיץ', 'שמשי', 'אביב'],
  ['חורף', 'גשום', 'סתיו', 'גשם'],
  ['זול', 'קל'],
  ['יקר', 'כבד'],
  // מושגים קרובים שעלולים להתאים לאותו משפט השלמה (לא נרדפות ממש)
  ['גבוה', 'ארוך'],
  ['נמוך', 'קצר'],
  ['שמן', 'עבה'],
  ['רזה', 'דק'],
  ['ער', 'מתעורר'],
  ['ישן', 'נרדם'],
  ['בא', 'מגיע'],
  ['מדבר', 'צועק'],
  ['שותק', 'לוחש'],
  ['מנומס', 'עדין'],
  ['חצוף', 'גס'],
];

const SYNONYM_INDEX: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const map = new Map<string, Set<string>>();
  for (const group of SYNONYM_GROUPS) {
    for (const w of group) {
      const set = map.get(w) ?? new Set<string>();
      for (const other of group) set.add(other);
      map.set(w, set);
    }
  }
  return map;
})();

/** המילה עצמה + כל המילים הנרדפות לה. */
export function synonymsOf(word: string): ReadonlySet<string> {
  return SYNONYM_INDEX.get(word) ?? new Set([word]);
}

/** האש (FNV-1a) של מחרוזת למספר שלם 32 ביט. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** מחולל מספרים אקראיים דטרמיניסטי (mulberry32) מתוך seed טקסטואלי. מחזיר ערכים ב־[0,1). */
export function seededRng(seed: string): () => number {
  let a = hashSeed(seed) || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ערבוב Fisher–Yates עם rng נתון (לא משנה את המערך המקורי). */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

type WordKind = 'phrase' | 'verb' | 'other';

/** סיווג גס של "סוג" המילה כדי להעדיף מסיחים מאותו חלק דיבר. */
function kindOf(word: string, category: Category): WordKind {
  if (word.includes(' ')) return 'phrase';
  if (category === 'ACTIONS') return 'verb';
  return 'other';
}

interface Candidate {
  text: string;
  category: Category;
  kind: WordKind;
}

/**
 * בוחר `count` מסיחים (תשובות שגויות סבירות) עבור זוג נתון.
 * - לעולם לא מחזיר את מילת הזוג, את ההפך שלה, מילים נרדפות להן,
 *   או מילה שהיא הפך תקף של אחת ממילות הזוג בזוג אחר.
 * - מעדיף מילים מאותה קטגוריה ומאותו סוג (פועל/תואר/ביטוי).
 * - הערכים המוחזרים ייחודיים. אם אין מספיק מועמדים – מחזיר פחות מ־count.
 */
export function pickDistractors(
  pair: WordPairContent,
  all: WordPairContent[],
  count: number,
  rng: () => number,
): string[] {
  if (count <= 0) return [];

  const forbidden = new Set<string>();
  const ban = (w: string): void => {
    for (const s of synonymsOf(w)) forbidden.add(s);
  };
  ban(pair.word);
  ban(pair.opposite);
  // הפכים תקפים של כל אחת ממילות הזוג בזוגות אחרים (למשל "קשה" ↔ "רך" וגם "קשה" ↔ "קל")
  for (const other of all) {
    if (other.word === pair.word || other.word === pair.opposite) ban(other.opposite);
    if (other.opposite === pair.word || other.opposite === pair.opposite) ban(other.word);
  }

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const other of all) {
    if (other.id === pair.id || !other.active) continue;
    for (const text of [other.word, other.opposite]) {
      if (forbidden.has(text) || seen.has(text)) continue;
      seen.add(text);
      candidates.push({ text, category: other.category, kind: kindOf(text, other.category) });
    }
  }

  const promptKind = kindOf(pair.word, pair.category);
  const answerKind = kindOf(pair.opposite, pair.category);
  const sameKind = (c: Candidate): boolean => c.kind === answerKind || c.kind === promptKind;
  const sameCategory = (c: Candidate): boolean => c.category === pair.category;

  const tiers: Candidate[][] = [
    candidates.filter((c) => sameCategory(c) && sameKind(c)),
    candidates.filter((c) => !sameCategory(c) && sameKind(c)),
    candidates.filter((c) => sameCategory(c) && !sameKind(c)),
    candidates.filter((c) => !sameCategory(c) && !sameKind(c)),
  ];

  const result: string[] = [];
  const used = new Set<string>();
  for (const tier of tiers) {
    if (result.length >= count) break;
    for (const c of shuffle(tier, rng)) {
      if (result.length >= count) break;
      if (used.has(c.text)) continue;
      used.add(c.text);
      result.push(c.text);
    }
  }
  return result;
}
