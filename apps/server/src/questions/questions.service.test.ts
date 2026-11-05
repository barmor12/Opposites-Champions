import { describe, expect, it, vi } from 'vitest';
import { QuestionType, Category, Difficulty } from '@prisma/client';
import { TREASURE_QUESTIONS, type GameSettings } from '@oc/shared';
import { QuestionsService, evenTypeMix, type PlayablePair, type SessionQuestionFull } from './questions.service';
import { seededRng } from './rng';
import { mockPrisma } from '../games/testing/prisma-mock';
import type { ContentService } from '../content/content.service';
import { DEFAULT_SETTINGS } from '../games/settings';

const CATS = Object.values(Category);
function pair(i: number, imageable: boolean): PlayablePair {
  const word = `מילה${i}`;
  const opposite = `הפך${i}`;
  const img = (side: string) => ({
    id: `m-${i}-${side}`, key: `k-${i}-${side}`, kind: 'WORD_IMAGE' as const, url: `/images/pairs/p${i}/${side}.svg`, alt: side,
    width: null, height: null, createdAt: new Date(), deletedAt: null,
  });
  return {
    id: `p${i}`, slug: `p${i}`, word, opposite,
    category: CATS[i % CATS.length] as Category, difficulty: Difficulty.EASY,
    sentence: `המשפט ${i} ____`, sentenceAnswer: 'opposite', explanation: null, imageable,
    wordImageId: imageable ? `m-${i}-word` : null, oppositeImageId: imageable ? `m-${i}-opposite` : null,
    wordImage: imageable ? img('word') : null, oppositeImage: imageable ? img('opposite') : null,
    supportedTypes: imageable
      ? [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE, QuestionType.PICTURE_TO_PICTURE]
      : [QuestionType.CHOOSE_OPPOSITE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE],
    active: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  };
}
const PAIRS: PlayablePair[] = Array.from({ length: 30 }, (_, i) => pair(i, i % 2 === 0));

function settings(over: Partial<GameSettings> = {}): GameSettings {
  return { ...DEFAULT_SETTINGS, className: 'ג1', questionCount: 20, treasureChallenge: true, ...over };
}

function buildService(pairs: PlayablePair[] = PAIRS, fallback: PlayablePair[] = pairs) {
  let counter = 0;
  const prisma = mockPrisma({
    question: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: `q${counter++}`, ...data })) },
    sessionQuestion: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const q = (prisma.question.create.mock.results.at(-1) as { value: Promise<Record<string, unknown>> }).value;
        const question = await q;
        const options = (question.options as { create: Array<Record<string, unknown>> }).create.map((o, idx) => ({ id: `${question.id}-o${idx}`, questionId: question.id, ...o }));
        return { id: `sq-${data.index as number}`, startedAt: null, endsAt: null, closedAt: null, ...data, question: { ...question, options } };
      }),
    },
  });
  const getPlayablePairs = vi.fn(async (filter: { categories?: string[] } = {}) => (filter.categories ? pairs : fallback));
  const content = { getPlayablePairs } as unknown as ContentService;
  return { service: new QuestionsService(prisma, content), prisma, content, getPlayablePairs };
}

/** מיפוי url של איור → הזוג והצד שלו (לבדיקת מקור האיורים) */
const IMAGE_OWNER = new Map<string, { pair: PlayablePair; side: 'word' | 'opposite' }>();
for (const p of PAIRS) {
  if (p.wordImage) IMAGE_OWNER.set(p.wordImage.url, { pair: p, side: 'word' });
  if (p.oppositeImage) IMAGE_OWNER.set(p.oppositeImage.url, { pair: p, side: 'opposite' });
}

describe('evenTypeMix', () => {
  it('spreads types evenly (difference ≤ 1) and is deterministic for a seed', () => {
    const types = [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS];
    const mix = evenTypeMix(types, 20, seededRng('seed'));
    const counts = new Map<string, number>();
    for (const t of mix) counts.set(t, (counts.get(t) ?? 0) + 1);
    const values = [...counts.values()];
    expect(mix).toHaveLength(20);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(evenTypeMix(types, 20, seededRng('seed'))).toEqual(mix);
    expect(evenTypeMix(types, 20, seededRng('other'))).not.toEqual(mix);
  });
});

describe('QuestionsService.buildSpecs', () => {
  const service = buildService().service;

  it('builds the requested number of questions with an even type mix', () => {
    const specs = service.buildSpecs(PAIRS, settings({ treasureChallenge: false }), seededRng('x'));
    expect(specs).toHaveLength(20);
    const counts = new Map<string, number>();
    for (const s of specs) counts.set(s.type, (counts.get(s.type) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual([...DEFAULT_SETTINGS.questionTypes].sort());
    const values = [...counts.values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  it('never uses MATCH_PAIRS for the treasure questions (last 5)', () => {
    const specs = service.buildSpecs(PAIRS, settings(), seededRng('t'));
    const treasure = specs.slice(-TREASURE_QUESTIONS);
    expect(treasure.every((s) => s.type !== QuestionType.MATCH_PAIRS)).toBe(true);
  });

  it('builds CHOOSE_IMAGE only from imageable pairs with 4 image options and exactly one correct', () => {
    const specs = service.buildSpecs(PAIRS, settings({ questionTypes: [QuestionType.CHOOSE_IMAGE], treasureChallenge: false, questionCount: 10 }), seededRng('i'));
    for (const s of specs) {
      expect(s.type).toBe(QuestionType.CHOOSE_IMAGE);
      expect(s.promptImage).toMatch(/word\.svg$/);
      expect(s.options).toHaveLength(4);
      expect(s.options.every((o) => typeof o.image === 'string')).toBe(true);
      expect(s.options.filter((o) => o.isCorrect)).toHaveLength(1);
      expect(new Set(s.options.map((o) => o.text)).size).toBe(4);
    }
  });

  describe('PICTURE_TO_PICTURE', () => {
    const pictureSettings = (over: Partial<GameSettings> = {}) =>
      settings({ questionTypes: [QuestionType.PICTURE_TO_PICTURE], treasureChallenge: false, questionCount: 20, difficulty: 'EASY', ...over });

    it('builds picture-only questions from imageable pairs: prompt image + 4 distinct image options, exactly one correct', () => {
      const specs = service.buildSpecs(PAIRS, pictureSettings(), seededRng('pic'));
      expect(specs).toHaveLength(20);
      for (const s of specs) {
        expect(s.type).toBe(QuestionType.PICTURE_TO_PICTURE);
        const source = PAIRS.find((p) => p.id === s.wordPairId);
        if (!source || !source.wordImage || !source.oppositeImage) throw new Error('question built from a non-imageable pair');
        expect(s.prompt).toBe(source.word); // המילה נשמרת להקראה/דוחות
        expect(s.promptImage).toBe(source.wordImage.url);
        expect(s.payload).toEqual({ kind: 'choice', pairId: source.id, word: source.word, opposite: source.opposite });
        expect(s.options).toHaveLength(4);
        expect(s.options.every((o) => typeof o.image === 'string' && o.image.length > 0)).toBe(true);
        const correct = s.options.filter((o) => o.isCorrect);
        expect(correct).toHaveLength(1);
        expect(correct[0]).toMatchObject({ text: source.opposite, image: source.oppositeImage.url });
        // איורים ייחודיים, ללא איור המילה עצמה ולא מהזוג של השאלה
        const images = s.options.map((o) => o.image as string);
        expect(new Set(images).size).toBe(4);
        expect(images).not.toContain(s.promptImage);
        expect(new Set(s.options.map((o) => o.text)).size).toBe(4);
        for (const o of s.options.filter((x) => !x.isCorrect)) {
          const owner = IMAGE_OWNER.get(o.image as string);
          expect(owner, `unknown image ${o.image}`).toBeDefined();
          expect(owner?.pair.id).not.toBe(source.id);
          expect(owner?.pair[owner.side]).toBe(o.text); // text = alt של אותו איור
          expect([source.word, source.opposite]).not.toContain(o.text);
        }
      }
    });

    it('prefers distractor images from the same category', () => {
      const specs = service.buildSpecs(PAIRS, pictureSettings(), seededRng('cat'));
      for (const s of specs) {
        const source = PAIRS.find((p) => p.id === s.wordPairId) as PlayablePair;
        for (const o of s.options.filter((x) => !x.isCorrect)) {
          expect(IMAGE_OWNER.get(o.image as string)?.pair.category).toBe(source.category);
        }
      }
    });

    it('never uses non-imageable pairs even when they match the filters', () => {
      const specs = service.buildSpecs(PAIRS, pictureSettings({ questionTypes: [QuestionType.PICTURE_TO_PICTURE, QuestionType.CHOOSE_OPPOSITE] }), seededRng('mix'));
      const picture = specs.filter((s) => s.type === QuestionType.PICTURE_TO_PICTURE);
      expect(picture.length).toBeGreaterThan(0);
      expect(specs.some((s) => s.type === QuestionType.CHOOSE_OPPOSITE)).toBe(true);
      for (const s of picture) expect(PAIRS.find((p) => p.id === s.wordPairId)?.imageable).toBe(true);
    });

    it('is allowed in the treasure questions', () => {
      const specs = service.buildSpecs(PAIRS, pictureSettings({ treasureChallenge: true }), seededRng('tr'));
      expect(specs.slice(-TREASURE_QUESTIONS).every((s) => s.type === QuestionType.PICTURE_TO_PICTURE)).toBe(true);
    });

    it('falls back to the extra imageable pool only when the filtered pool has fewer than 4 imageable pairs', () => {
      const few = PAIRS.slice(0, 5); // p0, p2, p4 imageable – רק 3
      // בלי מאגר חלופי: פחות מ־4 זוגות בכלל → שגיאה; 5 זוגות אך רק 3 עם איורים → נסיגה ל־CHOOSE_OPPOSITE (כמו CHOOSE_IMAGE)
      expect(() => service.buildSpecs(PAIRS.slice(0, 3), pictureSettings(), seededRng('nf'))).toThrowError(/זוגות/);
      expect(() => service.buildSpecs(PAIRS.slice(0, 3), pictureSettings(), seededRng('nf'), PAIRS.slice(0, 3))).toThrowError(/זוגות/);
      expect(service.buildSpecs(few, pictureSettings(), seededRng('nf')).every((s) => s.type === QuestionType.CHOOSE_OPPOSITE)).toBe(true);
      // עם מאגר חלופי: גם 3 זוגות בלבד במאגר המסונן מספיקים כדי למלא את המשחק בשאלות תמונה
      expect(service.buildSpecs(PAIRS.slice(0, 3), pictureSettings(), seededRng('fb3'), PAIRS).every((s) => s.type === QuestionType.PICTURE_TO_PICTURE)).toBe(true);
      const specs = service.buildSpecs(few, pictureSettings(), seededRng('fb'), PAIRS);
      expect(specs).toHaveLength(20);
      expect(specs.every((s) => s.type === QuestionType.PICTURE_TO_PICTURE)).toBe(true);
      const usedIds = new Set(specs.map((s) => s.wordPairId));
      expect([...usedIds].some((id) => !few.some((p) => p.id === id))).toBe(true);
      // כשהמאגר המסונן מספיק – המאגר החלופי אינו בשימוש
      const enough = PAIRS.slice(0, 8); // p0,p2,p4,p6 imageable
      const own = service.buildSpecs(enough, pictureSettings(), seededRng('own'), PAIRS);
      expect(own.every((s) => enough.some((p) => p.id === s.wordPairId))).toBe(true);
      expect(own.every((s) => s.options.every((o) => enough.some((p) => p.wordImage?.url === o.image || p.oppositeImage?.url === o.image)))).toBe(true);
    });

    it('is deterministic for the same seed', () => {
      const a = service.buildSpecs(PAIRS, pictureSettings(), seededRng('d'));
      const b = service.buildSpecs(PAIRS, pictureSettings(), seededRng('d'));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });

  it('builds MATCH_PAIRS with 8 cards and 4 correct pairs that reference existing cards', () => {
    const specs = service.buildSpecs(PAIRS, settings({ questionTypes: [QuestionType.MATCH_PAIRS], treasureChallenge: false, questionCount: 10 }), seededRng('m'));
    for (const s of specs) {
      expect(s.payload.kind).toBe('match');
      if (s.payload.kind !== 'match') continue;
      expect(s.payload.cards).toHaveLength(8);
      expect(s.payload.pairs).toHaveLength(4);
      const ids = new Set(s.payload.cards.map((c) => c.id));
      expect(ids.size).toBe(8);
      for (const p of s.payload.pairs) {
        expect(ids.has(p.cardA) && ids.has(p.cardB)).toBe(true);
      }
    }
  });

  it('falls back to a playable type when CHOOSE_IMAGE has no imageable pairs', () => {
    const noImages = PAIRS.map((p) => ({ ...p, imageable: false, wordImage: null, oppositeImage: null }));
    const specs = service.buildSpecs(noImages, settings({ questionTypes: [QuestionType.CHOOSE_IMAGE], treasureChallenge: false, questionCount: 10 }), seededRng('f'));
    expect(specs.every((s) => s.type === QuestionType.CHOOSE_OPPOSITE)).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = service.buildSpecs(PAIRS, settings(), seededRng('same'));
    const b = service.buildSpecs(PAIRS, settings(), seededRng('same'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('throws a Hebrew 400 when there are not enough pairs', () => {
    expect(() => service.buildSpecs(PAIRS.slice(0, 3), settings(), seededRng('n'))).toThrowError(/זוגות/);
  });
});

describe('QuestionsService.generateSessionQuestions', () => {
  it('fetches the imageable fallback pool for PICTURE_TO_PICTURE when the filtered pool is too small', async () => {
    const few = PAIRS.slice(0, 5);
    const { service, getPlayablePairs } = buildService(few, PAIRS);
    const created = await service.generateSessionQuestions('s1', settings({ questionTypes: [QuestionType.PICTURE_TO_PICTURE], treasureChallenge: false, categories: [Category.ANIMALS_NATURE] }), 'seed');
    expect(created).toHaveLength(20);
    expect(created.every((sq) => sq.question.type === QuestionType.PICTURE_TO_PICTURE)).toBe(true);
    expect(getPlayablePairs).toHaveBeenCalledTimes(2);
    expect(getPlayablePairs.mock.calls[1]?.[0]).toMatchObject({ types: [QuestionType.PICTURE_TO_PICTURE], requireImages: true });
    expect(getPlayablePairs.mock.calls[1]?.[0]).not.toHaveProperty('categories');
  });

  it('does not fetch the fallback pool when the filtered pool is sufficient', async () => {
    const { service, getPlayablePairs } = buildService();
    await service.generateSessionQuestions('s1', settings({ questionTypes: [QuestionType.PICTURE_TO_PICTURE], treasureChallenge: false }), 'seed');
    expect(getPlayablePairs).toHaveBeenCalledTimes(1);
  });

  it('marks the last 5 questions as treasure with steps 1..5 and sets the time limit', async () => {
    const { service } = buildService();
    const created = await service.generateSessionQuestions('s1', settings({ timePerQuestionSec: 20 }), 'seed');
    expect(created).toHaveLength(20);
    expect(created.slice(0, 15).every((sq) => !sq.isTreasure && sq.treasureStep === null)).toBe(true);
    expect(created.slice(15).map((sq) => sq.treasureStep)).toEqual([1, 2, 3, 4, 5]);
    expect(created.every((sq) => sq.timeLimitMs === 20_000)).toBe(true);
    expect(created.map((sq) => sq.index)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
});

describe('QuestionsService.toQuestionView / checkAnswer', () => {
  async function firstOf(type: QuestionType): Promise<{ service: QuestionsService; sq: SessionQuestionFull }> {
    const { service } = buildService();
    const created = await service.generateSessionQuestions('s1', settings({ questionTypes: [type], treasureChallenge: false, questionCount: 10, timePerQuestionSec: 15 }), 'v');
    return { service, sq: created[0] as SessionQuestionFull };
  }

  it('never leaks correctness information in QuestionView', async () => {
    for (const type of [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE, QuestionType.PICTURE_TO_PICTURE]) {
      const { service, sq } = await firstOf(type);
      const view = service.toQuestionView(sq, 1_000, 10, 1_500);
      const json = JSON.stringify(view);
      expect(json).not.toMatch(/isCorrect/);
      expect(json).not.toMatch(/"pairs"/);
      expect(json).not.toMatch(/cardA/);
      expect(view.startedAt).toBe(1_000);
      expect(view.endsAt).toBe(16_000);
      expect(view.serverNow).toBe(1_500);
      expect(view.total).toBe(10);
      if (type === QuestionType.MATCH_PAIRS) {
        expect(view.matchCards).toHaveLength(8);
        expect(view.matchPairsCount).toBe(4);
        expect(view.options).toEqual([]);
      } else {
        expect(view.options).toHaveLength(4);
        const withImages = type === QuestionType.CHOOSE_IMAGE || type === QuestionType.PICTURE_TO_PICTURE;
        expect(Object.keys(view.options[0] as object).sort()).toEqual(withImages ? ['id', 'image', 'text'] : ['id', 'text']);
      }
      if (type === QuestionType.PICTURE_TO_PICTURE) {
        expect(view.type).toBe(QuestionType.PICTURE_TO_PICTURE);
        expect(view.promptImage).toMatch(/word\.svg$/);
        expect(view.options.every((o) => typeof o.image === 'string')).toBe(true);
        expect(view.options.map((o) => o.image)).not.toContain(view.promptImage);
      }
    }
  });

  it('checks PICTURE_TO_PICTURE answers exactly like CHOOSE_IMAGE and reports the opposite word for reports', async () => {
    const { service, sq } = await firstOf(QuestionType.PICTURE_TO_PICTURE);
    const correct = sq.question.options.find((o) => o.isCorrect);
    const wrong = sq.question.options.find((o) => !o.isCorrect);
    if (!correct || !wrong) throw new Error('bad fixture');
    expect(service.checkAnswer(sq, { sessionQuestionId: sq.id, optionId: correct.id })).toMatchObject({ correct: true, correctOptionId: correct.id, matchedCount: 1, totalPairs: 1, mistakes: 0 });
    expect(service.checkAnswer(sq, { sessionQuestionId: sq.id, optionId: wrong.id })).toMatchObject({ correct: false, correctOptionId: correct.id, mistakes: 1 });
    expect(service.correctInfo(sq)).toMatchObject({ correctOptionId: correct.id });
    const source = PAIRS.find((p) => p.id === sq.question.wordPairId);
    expect(service.correctAnswerText(sq)).toBe(source?.opposite);
    expect(service.isMatch(sq)).toBe(false);
  });

  it('checks choice answers and reports the correct option', async () => {
    const { service, sq } = await firstOf(QuestionType.CHOOSE_OPPOSITE);
    const correct = sq.question.options.find((o) => o.isCorrect);
    const wrong = sq.question.options.find((o) => !o.isCorrect);
    if (!correct || !wrong) throw new Error('bad fixture');
    expect(service.checkAnswer(sq, { sessionQuestionId: sq.id, optionId: correct.id })).toMatchObject({ correct: true, correctOptionId: correct.id });
    expect(service.checkAnswer(sq, { sessionQuestionId: sq.id, optionId: wrong.id })).toMatchObject({ correct: false, correctOptionId: correct.id, mistakes: 1 });
    expect(() => service.checkAnswer(sq, { sessionQuestionId: sq.id, optionId: 'nope' })).toThrowError(/שייכת/);
  });

  it('checks match answers, counting matched pairs and mistakes server-side', async () => {
    const { service, sq } = await firstOf(QuestionType.MATCH_PAIRS);
    const info = service.correctInfo(sq);
    const pairs = info.correctMatches ?? [];
    expect(pairs).toHaveLength(4);
    const full = service.checkAnswer(sq, { sessionQuestionId: sq.id, matches: pairs.map((p) => ({ cardA: p.cardB, cardB: p.cardA })), mistakes: 99 });
    expect(full).toMatchObject({ correct: true, matchedCount: 4, totalPairs: 4, mistakes: 0 });
    const [p0, p1] = pairs as [{ cardA: string; cardB: string }, { cardA: string; cardB: string }];
    const partial = service.checkAnswer(sq, { sessionQuestionId: sq.id, matches: [p0, { cardA: p1.cardA, cardB: p0.cardB }, p0], mistakes: 0 });
    expect(partial).toMatchObject({ correct: false, matchedCount: 1, mistakes: 1 });
  });
});
