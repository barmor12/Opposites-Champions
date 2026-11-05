import { Injectable, Logger } from '@nestjs/common';
import { QuestionType, type Prisma, type SessionQuestion } from '@prisma/client';
import {
  MATCH_PAIRS_PER_QUESTION, TREASURE_QUESTIONS,
  type AnswerPayload, type GameSettings, type MatchCardView, type QuestionOptionView, type QuestionView,
} from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ContentService } from '../content/content.service';
import { GameError } from '../games/game-error';
import { pickDistractors, synonymsOf } from '@oc/content';
import { toWordPairRecord } from '../content/content.service';
import { pairKey, parseQuestionPayload, payloadToJson, type MatchPair, type QuestionPayload } from './question-payload';
import { pick, randomId, seededRng, shuffle, type Rng } from './rng';

export type PlayablePair = Prisma.WordPairGetPayload<{ include: { wordImage: true; oppositeImage: true } }>;
export type SessionQuestionFull = Prisma.SessionQuestionGetPayload<{ include: { question: { include: { options: true } } } }>;

export const SESSION_QUESTION_INCLUDE = { question: { include: { options: true } } } as const;

export interface AnswerCheck {
  correct: boolean;
  selectedOptionId?: string;
  correctOptionId?: string;
  correctMatches?: MatchPair[];
  matchedCount: number;
  totalPairs: number;
  mistakes: number;
  explanation?: string;
  /** מידע מובנה לרישום ב־StudentAnswer.answerPayload */
  answerPayload: Prisma.InputJsonValue | null;
}

interface OptionSpec {
  text: string;
  image?: string;
  isCorrect: boolean;
}

interface QuestionSpec {
  type: QuestionType;
  wordPairId: string | null;
  prompt: string;
  promptImage: string | null;
  explanation: string | null;
  payload: QuestionPayload;
  options: OptionSpec[]; // כבר מעורבבים
}

const DISTRACTOR_COUNT = 3;
const MIN_POOL = DISTRACTOR_COUNT + 1;
const PLAYABLE_TYPES: readonly QuestionType[] = [
  QuestionType.CHOOSE_OPPOSITE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS, QuestionType.COMPLETE_SENTENCE,
  QuestionType.PICTURE_TO_PICTURE,
];

type ImagedPair = PlayablePair & { wordImage: NonNullable<PlayablePair['wordImage']>; oppositeImage: NonNullable<PlayablePair['oppositeImage']> };

function hasImages(p: PlayablePair): p is ImagedPair {
  return p.imageable && p.wordImage !== null && p.oppositeImage !== null;
}

function supportsType(p: PlayablePair, type: QuestionType): boolean {
  return p.supportedTypes.length === 0 || p.supportedTypes.includes(type);
}

/** זוגות עם איורים שתומכים ב"תמונה מול תמונה" */
function picturePairs(pairs: readonly PlayablePair[]): ImagedPair[] {
  return pairs.filter(hasImages).filter((p) => supportsType(p, QuestionType.PICTURE_TO_PICTURE));
}

function explanationFor(p: PlayablePair): string {
  return p.explanation ?? `ההפך של "${p.word}" הוא "${p.opposite}"`;
}

/** חלוקה שווה של סוגי שאלות על פני N משבצות, בסדר אקראי */
export function evenTypeMix(types: readonly QuestionType[], count: number, rng: Rng): QuestionType[] {
  if (types.length === 0 || count <= 0) return [];
  const order = shuffle(types, rng);
  const seq: QuestionType[] = [];
  for (let i = 0; i < count; i += 1) seq.push(order[i % order.length] as QuestionType);
  return shuffle(seq, rng);
}

/** חפיסת זוגות: מעדיפה זוגות שטרם שימשו, ומאפשרת חזרה רק כשנגמרו */
class PairDeck {
  private readonly used = new Set<string>();

  constructor(private readonly rng: Rng) {}

  take(pool: readonly PlayablePair[]): PlayablePair {
    let fresh = pool.filter((p) => !this.used.has(p.id));
    if (fresh.length === 0) {
      pool.forEach((p) => this.used.delete(p.id));
      fresh = [...pool];
    }
    const chosen = pick(fresh, this.rng);
    this.used.add(chosen.id);
    return chosen;
  }

  takeMany(pool: readonly PlayablePair[], n: number): PlayablePair[] {
    const out: PlayablePair[] = [];
    const seen = new Set<string>();
    while (out.length < n) {
      const p = this.take(pool);
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }
}

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(private readonly prisma: PrismaService, private readonly content: ContentService) {}

  /** בונה את כל שאלות הסבב ושומר אותן (Question + QuestionOption + SessionQuestion) */
  async generateSessionQuestions(sessionId: string, settings: GameSettings, seed: string | number): Promise<SessionQuestionFull[]> {
    const rng = seededRng(seed);
    const requestedTypes = settings.questionTypes.filter((t): t is QuestionType => (PLAYABLE_TYPES as readonly string[]).includes(t));
    const pairs = await this.content.getPlayablePairs({
      categories: settings.categories,
      difficulty: settings.difficulty,
      types: requestedTypes.length > 0 ? requestedTypes : [...PLAYABLE_TYPES],
    });
    const pictureFallback = requestedTypes.includes(QuestionType.PICTURE_TO_PICTURE) && picturePairs(pairs).length < MIN_POOL
      ? await this.pictureFallbackPairs(settings)
      : [];
    const specs = this.buildSpecs(pairs, settings, rng, pictureFallback);
    const timeLimitMs = Math.max(0, settings.timePerQuestionSec) * 1000;
    const treasureStart = specs.length - this.treasureCount(settings);

    return this.prisma.$transaction(async (tx) => {
      const created: SessionQuestionFull[] = [];
      for (let index = 0; index < specs.length; index += 1) {
        const spec = specs[index] as QuestionSpec;
        const question = await tx.question.create({
          data: {
            type: spec.type,
            wordPairId: spec.wordPairId,
            prompt: spec.prompt,
            promptImage: spec.promptImage,
            explanation: spec.explanation,
            payload: payloadToJson(spec.payload),
            options: { create: spec.options.map((o, order) => ({ text: o.text, image: o.image ?? null, isCorrect: o.isCorrect, order })) },
          },
        });
        const isTreasure = index >= treasureStart;
        const sq = await tx.sessionQuestion.create({
          data: {
            sessionId,
            questionId: question.id,
            index,
            isTreasure,
            treasureStep: isTreasure ? index - treasureStart + 1 : null,
            timeLimitMs,
          },
          include: SESSION_QUESTION_INCLUDE,
        });
        created.push(sq);
      }
      return created;
    });
  }

  /**
   * מאגר חלופי ל"תמונה מול תמונה": כשסינון הקטגוריות/רמת הקושי משאיר פחות מ־4 זוגות עם איורים,
   * המשחק עדיין חייב להתמלא ב־questionCount שאלות – לכן נופלים לכל הזוגות עם איורים
   * (קודם תוך שמירה על רמת הקושי, ואם גם זה לא מספיק – ללא כל סינון). הקטגוריה מתעלמת במכוון.
   */
  private async pictureFallbackPairs(settings: GameSettings): Promise<PlayablePair[]> {
    const types = [QuestionType.PICTURE_TO_PICTURE];
    const sameDifficulty = await this.content.getPlayablePairs({ difficulty: settings.difficulty, types, requireImages: true });
    if (picturePairs(sameDifficulty).length >= MIN_POOL) return sameDifficulty;
    const all = await this.content.getPlayablePairs({ types, requireImages: true });
    if (picturePairs(all).length < MIN_POOL) return sameDifficulty;
    this.logger.warn('PICTURE_TO_PICTURE: falling back to all imageable pairs (category/difficulty filters ignored)');
    return all;
  }

  /**
   * בניית מפרטי השאלות בזיכרון (ללא DB) – נגיש לבדיקות יחידה.
   * `pictureFallback` – זוגות עם איורים (ללא סינון קטגוריה) שמשמשים ל־PICTURE_TO_PICTURE בלבד,
   * ורק אם ב־`pairs` יש פחות מ־4 זוגות מתאימים (ראו pictureFallbackPairs).
   */
  buildSpecs(pairs: readonly PlayablePair[], settings: GameSettings, rng: Rng, pictureFallback: readonly PlayablePair[] = []): QuestionSpec[] {
    const imageable = pairs.filter(hasImages);
    const ownPicturePool = picturePairs(pairs);
    const picturePool: ImagedPair[] = ownPicturePool.length >= MIN_POOL ? ownPicturePool : (() => {
      const fallback = picturePairs(pictureFallback);
      return fallback.length >= MIN_POOL ? fallback : ownPicturePool;
    })();
    if (pairs.length < MIN_POOL && picturePool.length < MIN_POOL) {
      throw GameError.badRequest('NOT_ENOUGH_PAIRS', 'אין מספיק זוגות מילים להגדרות שנבחרו');
    }
    const poolFor = (type: QuestionType): PlayablePair[] => {
      if (type === QuestionType.PICTURE_TO_PICTURE) return picturePool.length >= MIN_POOL ? picturePool : [];
      const base = type === QuestionType.CHOOSE_IMAGE ? imageable : pairs;
      const supporting = base.filter((p) => supportsType(p, type));
      return supporting.length >= (type === QuestionType.MATCH_PAIRS ? MATCH_PAIRS_PER_QUESTION : 1) ? supporting : [];
    };
    const requested = settings.questionTypes.filter((t): t is QuestionType => (PLAYABLE_TYPES as readonly string[]).includes(t));
    let active = (requested.length > 0 ? requested : [...PLAYABLE_TYPES]).filter((t) => {
      if (t === QuestionType.CHOOSE_IMAGE) return imageable.length >= MIN_POOL && poolFor(t).length > 0;
      // סוגים טקסטואליים זקוקים ל־4 זוגות לפחות במאגר המסונן (למסיחים)
      if (t !== QuestionType.PICTURE_TO_PICTURE && pairs.length < MIN_POOL) return false;
      return poolFor(t).length > 0;
    });
    if (active.length === 0) {
      if (pairs.length < MIN_POOL) throw GameError.badRequest('NOT_ENOUGH_PAIRS', 'אין מספיק זוגות מילים להגדרות שנבחרו');
      active = [QuestionType.CHOOSE_OPPOSITE];
    }

    const total = settings.questionCount;
    const treasureCount = this.treasureCount(settings);
    const regularCount = total - treasureCount;
    let treasureTypes = active.filter((t) => t !== QuestionType.MATCH_PAIRS);
    if (treasureTypes.length === 0) treasureTypes = [QuestionType.CHOOSE_OPPOSITE];

    const sequence = [...evenTypeMix(active, regularCount, rng), ...evenTypeMix(treasureTypes, treasureCount, rng)];
    const deck = new PairDeck(rng);
    return sequence.map((type) => {
      switch (type) {
        case QuestionType.CHOOSE_IMAGE:
          return this.chooseImageSpec(deck.take(poolFor(type)), imageable, rng);
        case QuestionType.PICTURE_TO_PICTURE:
          return this.pictureToPictureSpec(deck.take(poolFor(type)) as ImagedPair, picturePool, pairs, rng);
        case QuestionType.MATCH_PAIRS:
          return this.matchPairsSpec(deck.takeMany(poolFor(type), MATCH_PAIRS_PER_QUESTION), rng);
        case QuestionType.COMPLETE_SENTENCE:
          return this.completeSentenceSpec(deck.take(poolFor(type)), pairs, rng);
        default:
          return this.chooseOppositeSpec(deck.take(poolFor(QuestionType.CHOOSE_OPPOSITE).length > 0 ? poolFor(QuestionType.CHOOSE_OPPOSITE) : pairs), pairs, rng);
      }
    });
  }

  private treasureCount(settings: GameSettings): number {
    return settings.treasureChallenge ? Math.min(TREASURE_QUESTIONS, settings.questionCount) : 0;
  }

  /** מסיחים טקסטואליים דרך @oc/content (מודע למילים נרדפות ולהפכים חלופיים) עם השלמה מהמאגר במקרה קצה */
  private distractorTexts(pair: PlayablePair, all: readonly PlayablePair[], forbidden: Set<string>, rng: Rng): string[] {
    const seen = new Set(forbidden);
    const texts: string[] = [];
    for (const text of pickDistractors(toWordPairRecord(pair), all.map(toWordPairRecord), DISTRACTOR_COUNT, rng)) {
      if (texts.length >= DISTRACTOR_COUNT) break;
      if (seen.has(text)) continue;
      seen.add(text);
      texts.push(text);
    }
    if (texts.length < DISTRACTOR_COUNT) {
      for (const p of shuffle(all, rng)) {
        for (const text of [p.opposite, p.word]) {
          if (texts.length >= DISTRACTOR_COUNT) break;
          if (!seen.has(text)) {
            seen.add(text);
            texts.push(text);
          }
        }
        if (texts.length >= DISTRACTOR_COUNT) break;
      }
    }
    return texts;
  }

  private chooseOppositeSpec(pair: PlayablePair, all: readonly PlayablePair[], rng: Rng): QuestionSpec {
    const distractors = this.distractorTexts(pair, all, new Set([pair.word, pair.opposite]), rng);
    const options: OptionSpec[] = shuffle([
      { text: pair.opposite, isCorrect: true },
      ...distractors.map((text) => ({ text, isCorrect: false })),
    ], rng);
    return {
      type: QuestionType.CHOOSE_OPPOSITE,
      wordPairId: pair.id,
      prompt: pair.word,
      promptImage: hasImages(pair) ? pair.wordImage.url : null,
      explanation: explanationFor(pair),
      payload: { kind: 'choice', pairId: pair.id, word: pair.word, opposite: pair.opposite },
      options,
    };
  }

  private chooseImageSpec(pair: PlayablePair, imageable: readonly PlayablePair[], rng: Rng): QuestionSpec {
    if (!hasImages(pair)) return this.chooseOppositeSpec(pair, imageable, rng);
    // מיפוי טקסט → תמונה עבור כל המילים הניתנות להמחשה
    const imageByText = new Map<string, string>();
    for (const p of imageable) {
      if (!hasImages(p)) continue;
      if (!imageByText.has(p.word)) imageByText.set(p.word, p.wordImage.url);
      if (!imageByText.has(p.opposite)) imageByText.set(p.opposite, p.oppositeImage.url);
    }
    const seen = new Set([pair.word, pair.opposite]);
    const distractors: OptionSpec[] = [];
    for (const text of pickDistractors(toWordPairRecord(pair), imageable.map(toWordPairRecord), DISTRACTOR_COUNT + 2, rng)) {
      if (distractors.length >= DISTRACTOR_COUNT) break;
      const image = imageByText.get(text);
      if (!image || seen.has(text)) continue;
      seen.add(text);
      distractors.push({ text, image, isCorrect: false });
    }
    if (distractors.length < DISTRACTOR_COUNT) {
      for (const d of shuffle(imageable, rng)) {
        if (distractors.length >= DISTRACTOR_COUNT) break;
        if (d.id === pair.id || !hasImages(d) || seen.has(d.word)) continue;
        seen.add(d.word);
        distractors.push({ text: d.word, image: d.wordImage.url, isCorrect: false });
      }
    }
    const options = shuffle([{ text: pair.opposite, image: pair.oppositeImage.url, isCorrect: true }, ...distractors], rng);
    return {
      type: QuestionType.CHOOSE_IMAGE,
      wordPairId: pair.id,
      prompt: pair.word,
      promptImage: pair.wordImage.url,
      explanation: explanationFor(pair),
      payload: { kind: 'choice', pairId: pair.id, word: pair.word, opposite: pair.opposite },
      options,
    };
  }

  /**
   * "תמונה מול תמונה" (רמה קלה ללא קריאה): ה־prompt הוא איור המילה (המילה נשמרת ב־prompt להקראה/דוחות),
   * וכל 4 האפשרויות הן איורים – איור ההפך + 3 איורים של מילים אחרות מהמאגר (עדיפות לאותה קטגוריה).
   * לעולם לא: איור המילה עצמה, איור של הפך תקף/נרדף של אחת ממילות הזוג, או אותו איור פעמיים.
   * `options[].text` = המילה (ל־alt ולהקראה בלבד). הבדיקה והניקוד זהים ל־CHOOSE_IMAGE.
   */
  private pictureToPictureSpec(pair: ImagedPair, pool: readonly ImagedPair[], all: readonly PlayablePair[], rng: Rng): QuestionSpec {
    const forbiddenTexts = new Set<string>();
    const ban = (w: string): void => {
      for (const syn of synonymsOf(w)) forbiddenTexts.add(syn);
    };
    ban(pair.word);
    ban(pair.opposite);
    for (const other of [...all, ...pool]) {
      if (other.word === pair.word || other.word === pair.opposite) ban(other.opposite);
      if (other.opposite === pair.word || other.opposite === pair.opposite) ban(other.word);
    }
    const usedImages = new Set<string>([pair.wordImage.url, pair.oppositeImage.url]);

    interface ImageCandidate { pairId: string; text: string; image: string; sameCategory: boolean }
    const candidates: ImageCandidate[] = [];
    for (const p of pool) {
      if (p.id === pair.id) continue;
      const sameCategory = p.category === pair.category;
      candidates.push({ pairId: p.id, text: p.word, image: p.wordImage.url, sameCategory });
      candidates.push({ pairId: p.id, text: p.opposite, image: p.oppositeImage.url, sameCategory });
    }
    // ערבוב ואז מיון יציב: אותה קטגוריה קודם
    const ordered = shuffle(candidates, rng).sort((a, b) => Number(b.sameCategory) - Number(a.sameCategory));
    const distractors: OptionSpec[] = [];
    const usedPairs = new Set<string>();
    const take = (c: ImageCandidate): void => {
      usedImages.add(c.image);
      forbiddenTexts.add(c.text);
      usedPairs.add(c.pairId);
      distractors.push({ text: c.text, image: c.image, isCorrect: false });
    };
    // מעבר ראשון: איור אחד לכל זוג (מגוון), מעבר שני: משלים גם מזוגות שכבר שימשו
    for (const allowUsedPair of [false, true]) {
      for (const c of ordered) {
        if (distractors.length >= DISTRACTOR_COUNT) break;
        if (usedImages.has(c.image) || forbiddenTexts.has(c.text)) continue;
        if (!allowUsedPair && usedPairs.has(c.pairId)) continue;
        take(c);
      }
    }
    const options = shuffle([{ text: pair.opposite, image: pair.oppositeImage.url, isCorrect: true }, ...distractors], rng);
    return {
      type: QuestionType.PICTURE_TO_PICTURE,
      wordPairId: pair.id,
      prompt: pair.word,
      promptImage: pair.wordImage.url,
      explanation: explanationFor(pair),
      payload: { kind: 'choice', pairId: pair.id, word: pair.word, opposite: pair.opposite },
      options,
    };
  }

  private completeSentenceSpec(pair: PlayablePair, all: readonly PlayablePair[], rng: Rng): QuestionSpec {
    const answer = pair.sentenceAnswer === 'word' ? pair.word : pair.opposite;
    const distractors = this.distractorTexts(pair, all, new Set([pair.word, pair.opposite]), rng);
    const options = shuffle([{ text: answer, isCorrect: true }, ...distractors.map((text) => ({ text, isCorrect: false }))], rng);
    return {
      type: QuestionType.COMPLETE_SENTENCE,
      wordPairId: pair.id,
      prompt: pair.sentence,
      promptImage: null,
      explanation: explanationFor(pair),
      payload: { kind: 'choice', pairId: pair.id, word: pair.word, opposite: pair.opposite },
      options,
    };
  }

  private matchPairsSpec(chosen: PlayablePair[], rng: Rng): QuestionSpec {
    const ids = new Set<string>();
    const nextId = (): string => {
      let id = randomId(rng);
      while (ids.has(id)) id = randomId(rng);
      ids.add(id);
      return id;
    };
    const cards: MatchCardView[] = [];
    const matches: MatchPair[] = [];
    for (const p of chosen) {
      const a: MatchCardView = { id: nextId(), text: p.word, ...(hasImages(p) ? { image: p.wordImage.url } : {}) };
      const b: MatchCardView = { id: nextId(), text: p.opposite, ...(hasImages(p) ? { image: p.oppositeImage.url } : {}) };
      cards.push(a, b);
      matches.push({ cardA: a.id, cardB: b.id });
    }
    return {
      type: QuestionType.MATCH_PAIRS,
      wordPairId: null,
      prompt: 'התאימו כל מילה להפך שלה',
      promptImage: null,
      explanation: chosen.map((p) => `${p.word} ↔ ${p.opposite}`).join(', '),
      payload: { kind: 'match', pairIds: chosen.map((p) => p.id), cards: shuffle(cards, rng), pairs: shuffle(matches, rng) },
      options: [],
    };
  }

  async getSessionQuestion(sessionId: string, index: number): Promise<SessionQuestionFull | null> {
    return this.prisma.sessionQuestion.findUnique({ where: { sessionId_index: { sessionId, index } }, include: SESSION_QUESTION_INCLUDE });
  }

  async listSessionQuestions(sessionId: string): Promise<SessionQuestionFull[]> {
    return this.prisma.sessionQuestion.findMany({ where: { sessionId }, include: SESSION_QUESTION_INCLUDE, orderBy: { index: 'asc' } });
  }

  /** תצוגת שאלה ללקוח – ללא כל מידע על נכונות */
  toQuestionView(sq: SessionQuestionFull, startedAt: Date | number, total: number, serverNow: number = Date.now()): QuestionView {
    const started = typeof startedAt === 'number' ? startedAt : startedAt.getTime();
    const payload = parseQuestionPayload(sq.question.payload);
    const options: QuestionOptionView[] = [...sq.question.options]
      .sort((a, b) => a.order - b.order)
      .map((o) => ({ id: o.id, text: o.text, ...(o.image ? { image: o.image } : {}) }));
    const view: QuestionView = {
      sessionQuestionId: sq.id,
      index: sq.index,
      total,
      type: sq.question.type,
      prompt: sq.question.prompt,
      ...(sq.question.promptImage ? { promptImage: sq.question.promptImage } : {}),
      options,
      isTreasure: sq.isTreasure,
      ...(sq.isTreasure && sq.treasureStep !== null ? { treasureStep: sq.treasureStep, treasureTotal: TREASURE_QUESTIONS } : {}),
      timeLimitMs: sq.timeLimitMs,
      startedAt: started,
      endsAt: sq.timeLimitMs > 0 ? started + sq.timeLimitMs : null,
      serverNow,
    };
    if (payload.kind === 'match') {
      view.matchCards = payload.cards.map((c) => ({ ...c }));
      view.matchPairsCount = payload.pairs.length;
    }
    return view;
  }

  /** המידע שנחשף רק בסגירת שאלה (teacher-paced) או בתוצאה (self-paced) */
  correctInfo(sq: SessionQuestionFull): { correctOptionId?: string; correctMatches?: MatchPair[]; explanation?: string } {
    const payload = parseQuestionPayload(sq.question.payload);
    const explanation = sq.question.explanation ?? undefined;
    if (payload.kind === 'match') return { correctMatches: payload.pairs.map((p) => ({ ...p })), ...(explanation ? { explanation } : {}) };
    const correct = sq.question.options.find((o) => o.isCorrect);
    return { ...(correct ? { correctOptionId: correct.id } : {}), ...(explanation ? { explanation } : {}) };
  }

  /** טקסט התשובה הנכונה (לדוחות) */
  correctAnswerText(sq: SessionQuestionFull): string {
    const payload = parseQuestionPayload(sq.question.payload);
    if (payload.kind === 'match') {
      const byId = new Map(payload.cards.map((c) => [c.id, c.text]));
      return payload.pairs.map((p) => `${byId.get(p.cardA) ?? '?'} ↔ ${byId.get(p.cardB) ?? '?'}`).join(', ');
    }
    return sq.question.options.find((o) => o.isCorrect)?.text ?? '';
  }

  /** בדיקת תשובה – בשרת בלבד */
  checkAnswer(sq: SessionQuestionFull, payload: AnswerPayload): AnswerCheck {
    const info = this.correctInfo(sq);
    const stored = parseQuestionPayload(sq.question.payload);
    if (stored.kind === 'match') {
      if (!('matches' in payload) || !Array.isArray(payload.matches)) {
        throw GameError.badRequest('INVALID_ANSWER', 'תשובה לא תקינה לשאלת התאמה');
      }
      const validIds = new Set(stored.cards.map((c) => c.id));
      const correctKeys = new Set(stored.pairs.map((p) => pairKey(p.cardA, p.cardB)));
      const submitted = new Set<string>();
      let matched = 0;
      let mistakes = 0;
      for (const m of payload.matches) {
        if (typeof m?.cardA !== 'string' || typeof m?.cardB !== 'string') continue;
        if (!validIds.has(m.cardA) || !validIds.has(m.cardB) || m.cardA === m.cardB) {
          mistakes += 1;
          continue;
        }
        const key = pairKey(m.cardA, m.cardB);
        if (submitted.has(key)) continue;
        submitted.add(key);
        if (correctKeys.has(key)) matched += 1;
        else mistakes += 1;
      }
      const totalPairs = stored.pairs.length;
      return {
        correct: matched === totalPairs && totalPairs > 0,
        correctMatches: info.correctMatches,
        matchedCount: matched,
        totalPairs,
        mistakes,
        explanation: info.explanation,
        answerPayload: { matches: [...submitted].map((k) => k.split('|')).map(([cardA, cardB]) => ({ cardA: cardA ?? '', cardB: cardB ?? '' })), mistakes },
      };
    }
    if (!('optionId' in payload) || typeof payload.optionId !== 'string') {
      throw GameError.badRequest('INVALID_ANSWER', 'יש לבחור תשובה');
    }
    const option = sq.question.options.find((o) => o.id === payload.optionId);
    if (!option) throw GameError.badRequest('INVALID_OPTION', 'התשובה שנבחרה אינה שייכת לשאלה');
    return {
      correct: option.isCorrect,
      selectedOptionId: option.id,
      correctOptionId: info.correctOptionId,
      matchedCount: option.isCorrect ? 1 : 0,
      totalPairs: 1,
      mistakes: option.isCorrect ? 0 : 1,
      explanation: info.explanation,
      answerPayload: null,
    };
  }

  /** האם סוג השאלה הוא התאמת זוגות */
  isMatch(sq: SessionQuestion | SessionQuestionFull): boolean {
    return 'question' in sq ? sq.question.type === QuestionType.MATCH_PAIRS : false;
  }
}
