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
      ? [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE]
      : [QuestionType.CHOOSE_OPPOSITE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE],
    active: true, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  };
}
const PAIRS: PlayablePair[] = Array.from({ length: 30 }, (_, i) => pair(i, i % 2 === 0));

function settings(over: Partial<GameSettings> = {}): GameSettings {
  return { ...DEFAULT_SETTINGS, className: 'ג1', questionCount: 20, treasureChallenge: true, ...over };
}

function buildService() {
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
  const content = { getPlayablePairs: vi.fn(async () => PAIRS) } as unknown as ContentService;
  return { service: new QuestionsService(prisma, content), prisma, content };
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

  it('builds MATCH_PAIRS with 8 cards and 4 correct pairs whose ids carry no structure', () => {
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
        expect(p.cardA).not.toMatch(/[ab]$/);
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
    for (const type of [QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE]) {
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
        expect(Object.keys(view.options[0] as object).sort()).toEqual(type === QuestionType.CHOOSE_IMAGE ? ['id', 'image', 'text'] : ['id', 'text']);
      }
    }
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
