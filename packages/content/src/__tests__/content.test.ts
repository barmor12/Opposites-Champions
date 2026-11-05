import { describe, expect, it } from 'vitest';
import { AVATARS, Category, Difficulty, QuestionType } from '@oc/shared';
import type { WordPairContent } from '@oc/shared';
import {
  ABSTRACT_QUESTION_TYPES,
  ASSET_MANIFEST,
  IMAGEABLE_PAIRS,
  IMAGEABLE_QUESTION_TYPES,
  IMAGE_PAIR_SLUGS,
  WORD_PAIRS,
  getActivePairs,
  getPairsByCategory,
  pickDistractors,
  seededRng,
} from '../index';

const CATEGORIES = Object.values(Category);
const DIFFICULTIES = Object.values(Difficulty);
const QUESTION_TYPES = Object.values(QuestionType);

/** השוואת מילים בלי להתחשב באותיות סופיות (כדי לזהות "קטן" בתוך "קטנה"). */
const normalizeFinals = (s: string): string =>
  s.replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ');

const REQUIRED_SPEC_PAIRS: Array<[string, string]> = [
  ['גדול', 'קטן'], ['גבוה', 'נמוך'], ['ארוך', 'קצר'], ['רחב', 'צר'], ['כבד', 'קל'], ['עבה', 'דק'], ['עמוק', 'רדוד'],
  ['מלא', 'ריק'], ['שחור', 'לבן'], ['בהיר', 'כהה'], ['חם', 'קר'], ['יבש', 'רטוב'], ['מואר', 'חשוך'], ['דולק', 'כבוי'],
  ['שמח', 'עצוב'], ['אמיץ', 'פחדן'], ['רגוע', 'לחוץ'], ['אוהב', 'שונא'], ['חדש', 'ישן'], ['צעיר', 'זקן'], ['נקי', 'מלוכלך'],
  ['מסודר', 'מבולגן'], ['חלק', 'מחוספס'], ['רך', 'קשה'], ['חד', 'קהה'], ['ישר', 'עקום'], ['שלם', 'שבור'], ['פתוח', 'סגור'],
  ['בטוח', 'מסוכן'], ['שקט', 'רועש'], ['מהיר', 'איטי'], ['מוקדם', 'מאוחר'], ['יום', 'לילה'], ['בוקר', 'ערב'], ['קיץ', 'חורף'],
  ['למעלה', 'למטה'], ['בפנים', 'בחוץ'], ['ימין', 'שמאל'], ['קדימה', 'אחורה'], ['לפני', 'אחרי'], ['ראשון', 'אחרון'],
  ['קרוב', 'רחוק'], ['עולה', 'יורד'], ['נכנס', 'יוצא'], ['פותח', 'סוגר'], ['נותן', 'לוקח'], ['מושך', 'דוחף'],
  ['מתחיל', 'מסיים'], ['בונה', 'הורס'], ['מדליק', 'מכבה'], ['מוסיף', 'מחסיר'], ['מחבר', 'מפריד'], ['מרים', 'מוריד'],
  ['מתקרב', 'מתרחק'], ['ממלא', 'מרוקן'], ['זוכר', 'שוכח'], ['צוחק', 'בוכה'], ['מדבר', 'שותק'], ['שואל', 'עונה'],
  ['מצליח', 'נכשל'], ['מנצח', 'מפסיד'], ['חזק', 'חלש'], ['עשיר', 'עני'], ['אמת', 'שקר'], ['מותר', 'אסור'], ['נכון', 'שגוי'],
  ['הצלחה', 'כישלון'], ['ניצחון', 'הפסד'], ['חבר', 'אויב'], ['שלום', 'מלחמה'], ['גלוי', 'נסתר'], ['נוכח', 'נעדר'],
  ['יתרון', 'חיסרון'], ['שפע', 'מחסור'],
];

const pairKey = (a: string, b: string): string => [a, b].sort().join('|');

describe('WORD_PAIRS – structure', () => {
  it('has at least 210 pairs', () => {
    expect(WORD_PAIRS.length).toBeGreaterThanOrEqual(210);
  });

  it('has unique ids in kebab-case', () => {
    const ids = WORD_PAIRS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('has no duplicate pairs in either direction', () => {
    const keys = WORD_PAIRS.map((p) => pairKey(p.word, p.opposite));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never pairs a word with itself', () => {
    for (const p of WORD_PAIRS) expect(p.word).not.toBe(p.opposite);
  });

  it('every field is type-correct', () => {
    for (const p of WORD_PAIRS) {
      expect(typeof p.id).toBe('string');
      expect(p.word.trim().length).toBeGreaterThan(0);
      expect(p.opposite.trim().length).toBeGreaterThan(0);
      expect(p.word).toMatch(/^[֐-׿\s]+$/);
      expect(p.opposite).toMatch(/^[֐-׿\s]+$/);
      expect(CATEGORIES).toContain(p.category);
      expect(DIFFICULTIES).toContain(p.difficulty);
      expect(typeof p.sentence).toBe('string');
      expect(['word', 'opposite']).toContain(p.sentenceAnswer);
      if (p.explanation !== undefined) {
        expect(typeof p.explanation).toBe('string');
        expect(p.explanation.trim().length).toBeGreaterThan(0);
      }
      expect(typeof p.imageable).toBe('boolean');
      expect(Array.isArray(p.supportedTypes)).toBe(true);
      expect(p.supportedTypes.length).toBeGreaterThan(0);
      expect(new Set(p.supportedTypes).size).toBe(p.supportedTypes.length);
      for (const t of p.supportedTypes) expect(QUESTION_TYPES).toContain(t);
      expect(p.supportedTypes).not.toContain('TREASURE_CHALLENGE');
      expect(p.active).toBe(true);
    }
  });

  it('every pair has a sentence with ____ that contains the other word of the pair', () => {
    for (const p of WORD_PAIRS) {
      expect(p.sentence, p.id).toContain('____');
      expect(p.sentence.split('____').length, p.id).toBe(2);
      const answer = p.sentenceAnswer === 'word' ? p.word : p.opposite;
      const other = p.sentenceAnswer === 'word' ? p.opposite : p.word;
      expect(normalizeFinals(p.sentence), `${p.id}: sentence should contain "${other}"`).toContain(normalizeFinals(other));
      // התשובה עצמה לא צריכה להופיע במשפט (אחרת המשפט מסגיר אותה)
      const sentenceWords = p.sentence.replace(/[.,:!?–-]/g, ' ').split(/\s+/);
      expect(sentenceWords, `${p.id}: answer "${answer}" leaks into sentence`).not.toContain(answer);
    }
  });

  it('includes every pair required by the spec', () => {
    const keys = new Set(WORD_PAIRS.map((p) => pairKey(p.word, p.opposite)));
    for (const [a, b] of REQUIRED_SPEC_PAIRS) expect(keys.has(pairKey(a, b)), `${a}–${b}`).toBe(true);
  });

  it('every HARD pair has an explanation and ~60% of pairs overall do', () => {
    for (const p of WORD_PAIRS.filter((x) => x.difficulty === 'HARD')) {
      expect(p.explanation, p.id).toBeTruthy();
    }
    const withExplanation = WORD_PAIRS.filter((p) => p.explanation).length;
    expect(withExplanation / WORD_PAIRS.length).toBeGreaterThanOrEqual(0.55);
  });
});

describe('WORD_PAIRS – images', () => {
  it('includes every image slug from docs/IMAGE_PAIRS.md as an imageable pair', () => {
    expect(IMAGE_PAIR_SLUGS.length).toBeGreaterThanOrEqual(61);
    expect(new Set(IMAGE_PAIR_SLUGS).size).toBe(IMAGE_PAIR_SLUGS.length);
    const byId = new Map(WORD_PAIRS.map((p) => [p.id, p]));
    for (const slug of IMAGE_PAIR_SLUGS) {
      const p = byId.get(slug);
      expect(p, slug).toBeDefined();
      expect(p?.imageable).toBe(true);
    }
    expect(WORD_PAIRS.filter((p) => p.imageable).length).toBe(IMAGE_PAIR_SLUGS.length);
  });

  it('imageable pairs have both image paths and support all five per-pair question types', () => {
    for (const p of WORD_PAIRS) {
      if (p.imageable) {
        expect(p.wordImage).toBe(`/images/pairs/${p.id}/word.svg`);
        expect(p.oppositeImage).toBe(`/images/pairs/${p.id}/opposite.svg`);
        expect([...p.supportedTypes].sort()).toEqual(['CHOOSE_IMAGE', 'CHOOSE_OPPOSITE', 'COMPLETE_SENTENCE', 'MATCH_PAIRS', 'PICTURE_TO_PICTURE']);
      } else {
        expect(p.wordImage).toBeUndefined();
        expect(p.oppositeImage).toBeUndefined();
        expect([...p.supportedTypes].sort()).toEqual(['CHOOSE_OPPOSITE', 'COMPLETE_SENTENCE', 'MATCH_PAIRS']);
      }
    }
  });
});

describe('question type lists', () => {
  it('PICTURE_TO_PICTURE is an imageable-only type', () => {
    expect(IMAGEABLE_QUESTION_TYPES).toContain('PICTURE_TO_PICTURE');
    expect(ABSTRACT_QUESTION_TYPES).not.toContain('PICTURE_TO_PICTURE');
    expect(IMAGEABLE_PAIRS.length).toBe(IMAGE_PAIR_SLUGS.length);
    expect(IMAGEABLE_PAIRS.every((p) => p.supportedTypes.includes('PICTURE_TO_PICTURE'))).toBe(true);
    expect(WORD_PAIRS.filter((p) => !p.imageable).some((p) => p.supportedTypes.includes('PICTURE_TO_PICTURE'))).toBe(false);
  });
});

describe('WORD_PAIRS – distribution', () => {
  it('has at least 12 pairs in every category', () => {
    for (const c of CATEGORIES) {
      expect(getPairsByCategory(c).length, c).toBeGreaterThanOrEqual(12);
    }
  });

  it('difficulty split is roughly EASY 45% / MEDIUM 35% / HARD 20%', () => {
    const n = WORD_PAIRS.length;
    const share = (d: string): number => WORD_PAIRS.filter((p) => p.difficulty === d).length / n;
    expect(share('EASY')).toBeGreaterThanOrEqual(0.38);
    expect(share('EASY')).toBeLessThanOrEqual(0.52);
    expect(share('MEDIUM')).toBeGreaterThanOrEqual(0.28);
    expect(share('MEDIUM')).toBeLessThanOrEqual(0.42);
    expect(share('HARD')).toBeGreaterThanOrEqual(0.15);
    expect(share('HARD')).toBeLessThanOrEqual(0.27);
  });

  it('CHALLENGING category is mostly HARD', () => {
    const challenging = getPairsByCategory('CHALLENGING');
    const hard = challenging.filter((p) => p.difficulty === 'HARD').length;
    expect(hard / challenging.length).toBeGreaterThan(0.5);
  });
});

describe('getActivePairs', () => {
  it('returns all active pairs without a filter', () => {
    expect(getActivePairs().length).toBe(WORD_PAIRS.filter((p) => p.active).length);
  });

  it('filters by categories, difficulty and types', () => {
    const sizesEasy = getActivePairs({ categories: ['SIZES'], difficulty: 'EASY' });
    expect(sizesEasy.length).toBeGreaterThan(0);
    for (const p of sizesEasy) {
      expect(p.category).toBe('SIZES');
      expect(p.difficulty).toBe('EASY');
    }
    const images = getActivePairs({ types: ['CHOOSE_IMAGE'] });
    expect(images.length).toBe(IMAGE_PAIR_SLUGS.length);
    const pictureOnly = getActivePairs({ types: ['PICTURE_TO_PICTURE'] });
    expect(pictureOnly.length).toBe(IMAGE_PAIR_SLUGS.length);
    expect(pictureOnly.every((p) => p.imageable && p.wordImage && p.oppositeImage)).toBe(true);
    expect(getActivePairs({ difficulty: 'MIXED' }).length).toBe(WORD_PAIRS.length);
    expect(getActivePairs({ categories: [] }).length).toBe(WORD_PAIRS.length);
    // TREASURE_CHALLENGE is not a per-pair type and must not exclude anything
    expect(getActivePairs({ types: ['TREASURE_CHALLENGE'] }).length).toBe(WORD_PAIRS.length);
  });
});

describe('seededRng', () => {
  it('is deterministic for the same seed and in [0,1)', () => {
    const a = seededRng('room-123');
    const b = seededRng('room-123');
    for (let i = 0; i < 50; i += 1) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(seededRng('x')()).not.toBe(seededRng('y')());
  });
});

describe('pickDistractors', () => {
  const oppositesOf = (word: string): Set<string> => {
    const set = new Set<string>();
    for (const p of WORD_PAIRS) {
      if (p.word === word) set.add(p.opposite);
      if (p.opposite === word) set.add(p.word);
    }
    return set;
  };

  it('never returns the answer, the prompt, or a valid opposite of either, and values are distinct', () => {
    for (const pair of WORD_PAIRS) {
      const rng = seededRng(`seed-${pair.id}`);
      const d = pickDistractors(pair, WORD_PAIRS, 3, rng);
      expect(d.length, pair.id).toBe(3);
      expect(new Set(d).size).toBe(d.length);
      expect(d).not.toContain(pair.word);
      expect(d).not.toContain(pair.opposite);
      for (const x of d) {
        expect(oppositesOf(pair.word).has(x), `${pair.id}: ${x} is an opposite of ${pair.word}`).toBe(false);
        expect(oppositesOf(pair.opposite).has(x), `${pair.id}: ${x} is an opposite of ${pair.opposite}`).toBe(false);
        expect(x.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('avoids synonyms of the answer', () => {
    const big = WORD_PAIRS.find((p) => p.id === 'big-small') as WordPairContent;
    for (let i = 0; i < 30; i += 1) {
      const d = pickDistractors(big, WORD_PAIRS, 3, seededRng(`s${i}`));
      expect(d).not.toContain('זעיר');
      expect(d).not.toContain('מקטין');
    }
    const fast = WORD_PAIRS.find((p) => p.id === 'fast-slow') as WordPairContent;
    for (let i = 0; i < 30; i += 1) {
      const d = pickDistractors(fast, WORD_PAIRS, 3, seededRng(`f${i}`));
      expect(d).not.toContain('לאט');
      expect(d).not.toContain('זריז');
    }
  });

  it('prefers the same category', () => {
    const pair = WORD_PAIRS.find((p) => p.id === 'give-take') as WordPairContent;
    const d = pickDistractors(pair, WORD_PAIRS, 3, seededRng('cat'));
    const byText = new Map<string, WordPairContent>();
    for (const p of WORD_PAIRS) {
      byText.set(p.word, p);
      byText.set(p.opposite, p);
    }
    for (const x of d) expect(byText.get(x)?.category).toBe('ACTIONS');
  });

  it('is deterministic for a given seed and respects count', () => {
    const pair = WORD_PAIRS[0] as WordPairContent;
    expect(pickDistractors(pair, WORD_PAIRS, 5, seededRng('a'))).toEqual(pickDistractors(pair, WORD_PAIRS, 5, seededRng('a')));
    expect(pickDistractors(pair, WORD_PAIRS, 0, seededRng('a'))).toEqual([]);
    expect(pickDistractors(pair, WORD_PAIRS, 5, seededRng('a')).length).toBe(5);
  });
});

describe('ASSET_MANIFEST', () => {
  it('has word images for every imageable pair, all avatars and 2 characters, with unique keys', () => {
    const keys = ASSET_MANIFEST.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    const wordImages = ASSET_MANIFEST.filter((a) => a.kind === 'WORD_IMAGE');
    expect(wordImages.length).toBe(IMAGE_PAIR_SLUGS.length * 2);
    for (const p of WORD_PAIRS.filter((x) => x.imageable)) {
      expect(keys).toContain(`pair:${p.id}:word`);
      expect(keys).toContain(`pair:${p.id}:opposite`);
      const w = ASSET_MANIFEST.find((a) => a.key === `pair:${p.id}:word`);
      expect(w?.url).toBe(p.wordImage);
      expect(w?.alt).toBe(p.word);
    }
    const avatars = ASSET_MANIFEST.filter((a) => a.kind === 'AVATAR');
    expect(avatars.length).toBe(AVATARS.length);
    for (const id of AVATARS) expect(avatars.find((a) => a.url === `/avatars/${id}.svg`)?.alt).toBeTruthy();
    const characters = ASSET_MANIFEST.filter((a) => a.kind === 'CHARACTER');
    expect(characters.map((c) => c.url).sort()).toEqual(['/images/characters/moon.svg', '/images/characters/sun.svg']);
    for (const a of ASSET_MANIFEST) {
      expect(a.url.startsWith('/')).toBe(true);
      expect(a.alt.length).toBeGreaterThan(0);
    }
  });
});
