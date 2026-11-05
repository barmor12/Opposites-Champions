/**
 * מחולל שאלות לגרסת הדמו (רץ בדפדפן, ללא שרת).
 * מקביל ל־QuestionsService.buildSpecs בשרת – אותם כללים: מסיחים מודעים למילים נרדפות,
 * "תמונה מול תמונה" רק מזוגות עם איורים, התאמת זוגות מ־4 זוגות, ואתגר האוצר ב־5 השאלות האחרונות.
 */
import {
  MATCH_PAIRS_PER_QUESTION,
  QuestionType,
  TREASURE_QUESTIONS,
  type GameSettings,
  type MatchCardView,
  type QuestionView,
  type WordPairContent,
} from '@oc/shared';
import { getActivePairs, pickDistractors, seededRng, shuffle, synonymsOf } from '@oc/content';
import { assetUrl } from '@/lib/assets';

export interface DemoOption {
  id: string;
  text: string;
  image?: string;
  isCorrect: boolean;
}

export interface DemoMatch {
  cardA: string;
  cardB: string;
}

export interface DemoQuestion {
  id: string;
  index: number;
  type: QuestionType;
  prompt: string;
  promptImage?: string;
  explanation: string;
  options: DemoOption[];
  cards?: MatchCardView[];
  pairs?: DemoMatch[];
  isTreasure: boolean;
  treasureStep?: number;
  timeLimitMs: number;
}

type Rng = () => number;
type ImagedPair = WordPairContent & { wordImage: string; oppositeImage: string };

const DISTRACTORS = 3;
const MIN_POOL = DISTRACTORS + 1;
const PLAYABLE: readonly QuestionType[] = [
  QuestionType.CHOOSE_OPPOSITE,
  QuestionType.CHOOSE_IMAGE,
  QuestionType.MATCH_PAIRS,
  QuestionType.COMPLETE_SENTENCE,
  QuestionType.PICTURE_TO_PICTURE,
];

const hasImages = (p: WordPairContent): p is ImagedPair => p.imageable && Boolean(p.wordImage) && Boolean(p.oppositeImage);
const supports = (p: WordPairContent, t: QuestionType): boolean => p.supportedTypes.length === 0 || p.supportedTypes.includes(t);
const explanationFor = (p: WordPairContent): string => p.explanation ?? `הַהֶפֶךְ שֶׁל "${p.word}" הוּא "${p.opposite}"`;

let counter = 0;
function nextId(rng: Rng): string {
  counter += 1;
  return `d${Math.floor(rng() * 1e9).toString(36)}${counter.toString(36)}`;
}

function evenTypeMix(types: readonly QuestionType[], count: number, rng: Rng): QuestionType[] {
  if (types.length === 0 || count <= 0) return [];
  const order = shuffle(types, rng);
  const seq: QuestionType[] = [];
  for (let i = 0; i < count; i += 1) seq.push(order[i % order.length] as QuestionType);
  return shuffle(seq, rng);
}

class Deck {
  private readonly used = new Set<string>();
  constructor(private readonly rng: Rng) {}
  take<T extends WordPairContent>(pool: readonly T[]): T {
    let fresh = pool.filter((p) => !this.used.has(p.id));
    if (fresh.length === 0) {
      pool.forEach((p) => this.used.delete(p.id));
      fresh = [...pool];
    }
    const chosen = fresh[Math.floor(this.rng() * fresh.length)] as T;
    this.used.add(chosen.id);
    return chosen;
  }
  takeMany<T extends WordPairContent>(pool: readonly T[], n: number): T[] {
    const out: T[] = [];
    const seen = new Set<string>();
    let guard = 0;
    while (out.length < n && guard < 100) {
      guard += 1;
      const p = this.take(pool);
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push(p);
    }
    return out;
  }
}

function textDistractors(pair: WordPairContent, all: readonly WordPairContent[], rng: Rng): string[] {
  const seen = new Set([pair.word, pair.opposite]);
  const out: string[] = [];
  for (const t of pickDistractors(pair, [...all], DISTRACTORS, rng)) {
    if (out.length >= DISTRACTORS || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  if (out.length < DISTRACTORS) {
    for (const p of shuffle(all, rng)) {
      for (const t of [p.opposite, p.word]) {
        if (out.length >= DISTRACTORS) break;
        if (!seen.has(t)) {
          seen.add(t);
          out.push(t);
        }
      }
      if (out.length >= DISTRACTORS) break;
    }
  }
  return out;
}

function img(path: string | undefined): string | undefined {
  return path ? assetUrl(path) : undefined;
}

type Spec = Omit<DemoQuestion, 'index' | 'isTreasure' | 'timeLimitMs'>;

function base(rng: Rng, type: QuestionType, prompt: string, promptImage: string | undefined, explanation: string, options: Array<Omit<DemoOption, 'id'>>): Spec {
  return {
    id: nextId(rng),
    type,
    prompt,
    ...(promptImage ? { promptImage } : {}),
    explanation,
    options: shuffle(options, rng).map((o) => ({ ...o, id: nextId(rng) })),
  };
}

function chooseOpposite(pair: WordPairContent, all: readonly WordPairContent[], rng: Rng): Spec {
  const d = textDistractors(pair, all, rng);
  return base(rng, QuestionType.CHOOSE_OPPOSITE, pair.word, img(hasImages(pair) ? pair.wordImage : undefined), explanationFor(pair), [
    { text: pair.opposite, isCorrect: true },
    ...d.map((text) => ({ text, isCorrect: false })),
  ]);
}

function completeSentence(pair: WordPairContent, all: readonly WordPairContent[], rng: Rng): Spec {
  const answer = pair.sentenceAnswer === 'word' ? pair.word : pair.opposite;
  const d = textDistractors(pair, all, rng);
  return base(rng, QuestionType.COMPLETE_SENTENCE, pair.sentence, undefined, explanationFor(pair), [
    { text: answer, isCorrect: true },
    ...d.map((text) => ({ text, isCorrect: false })),
  ]);
}

function chooseImage(pair: ImagedPair, imageable: readonly ImagedPair[], rng: Rng): Spec {
  const imageByText = new Map<string, string>();
  for (const p of imageable) {
    if (!imageByText.has(p.word)) imageByText.set(p.word, p.wordImage);
    if (!imageByText.has(p.opposite)) imageByText.set(p.opposite, p.oppositeImage);
  }
  const seen = new Set([pair.word, pair.opposite]);
  const d: Array<Omit<DemoOption, 'id'>> = [];
  for (const text of pickDistractors(pair, [...imageable], DISTRACTORS + 2, rng)) {
    if (d.length >= DISTRACTORS) break;
    const image = imageByText.get(text);
    if (!image || seen.has(text)) continue;
    seen.add(text);
    d.push({ text, image: assetUrl(image), isCorrect: false });
  }
  for (const p of shuffle(imageable, rng)) {
    if (d.length >= DISTRACTORS) break;
    if (p.id === pair.id || seen.has(p.word)) continue;
    seen.add(p.word);
    d.push({ text: p.word, image: assetUrl(p.wordImage), isCorrect: false });
  }
  return base(rng, QuestionType.CHOOSE_IMAGE, pair.word, assetUrl(pair.wordImage), explanationFor(pair), [
    { text: pair.opposite, image: assetUrl(pair.oppositeImage), isCorrect: true },
    ...d,
  ]);
}

function pictureToPicture(pair: ImagedPair, pool: readonly ImagedPair[], all: readonly WordPairContent[], rng: Rng): Spec {
  const forbidden = new Set<string>();
  const ban = (w: string) => {
    for (const s of synonymsOf(w)) forbidden.add(s);
  };
  ban(pair.word);
  ban(pair.opposite);
  for (const o of [...all, ...pool]) {
    if (o.word === pair.word || o.word === pair.opposite) ban(o.opposite);
    if (o.opposite === pair.word || o.opposite === pair.opposite) ban(o.word);
  }
  const usedImages = new Set([pair.wordImage, pair.oppositeImage]);
  const candidates = shuffle(
    pool.filter((p) => p.id !== pair.id).flatMap((p) => [
      { pairId: p.id, text: p.word, image: p.wordImage, same: p.category === pair.category },
      { pairId: p.id, text: p.opposite, image: p.oppositeImage, same: p.category === pair.category },
    ]),
    rng,
  );
  const d: Array<Omit<DemoOption, 'id'>> = [];
  const usedPairs = new Set<string>();
  for (const pass of [
    { sameOnly: true, allowUsed: false },
    { sameOnly: true, allowUsed: true },
    { sameOnly: false, allowUsed: false },
    { sameOnly: false, allowUsed: true },
  ]) {
    for (const c of candidates) {
      if (d.length >= DISTRACTORS) break;
      if (pass.sameOnly && !c.same) continue;
      if (!pass.allowUsed && usedPairs.has(c.pairId)) continue;
      if (usedImages.has(c.image) || forbidden.has(c.text)) continue;
      usedImages.add(c.image);
      forbidden.add(c.text);
      usedPairs.add(c.pairId);
      d.push({ text: c.text, image: assetUrl(c.image), isCorrect: false });
    }
  }
  return base(rng, QuestionType.PICTURE_TO_PICTURE, pair.word, assetUrl(pair.wordImage), explanationFor(pair), [
    { text: pair.opposite, image: assetUrl(pair.oppositeImage), isCorrect: true },
    ...d,
  ]);
}

function matchPairs(chosen: WordPairContent[], rng: Rng): Spec {
  const cards: MatchCardView[] = [];
  const pairs: DemoMatch[] = [];
  for (const p of chosen) {
    const a: MatchCardView = { id: nextId(rng), text: p.word, ...(hasImages(p) ? { image: assetUrl(p.wordImage) } : {}) };
    const b: MatchCardView = { id: nextId(rng), text: p.opposite, ...(hasImages(p) ? { image: assetUrl(p.oppositeImage) } : {}) };
    cards.push(a, b);
    pairs.push({ cardA: a.id, cardB: b.id });
  }
  return {
    id: nextId(rng),
    type: QuestionType.MATCH_PAIRS,
    prompt: 'הִתְאִימוּ כָּל מִילָּה לְהֶפֶךְ שֶׁלָּהּ',
    explanation: chosen.map((p) => `${p.word} ↔ ${p.opposite}`).join(', '),
    options: [],
    cards: shuffle(cards, rng),
    pairs: shuffle(pairs, rng),
  };
}

export function generateQuestions(settings: GameSettings, seed: string): DemoQuestion[] {
  const rng = seededRng(seed);
  const requested = settings.questionTypes.filter((t) => PLAYABLE.includes(t));
  const types = requested.length > 0 ? requested : [...PLAYABLE];
  let pairs = getActivePairs({ categories: settings.categories, difficulty: settings.difficulty, types });
  if (pairs.length < MIN_POOL) pairs = getActivePairs({ types });
  const imageable: ImagedPair[] = pairs.filter(hasImages);
  let picturePool: ImagedPair[] = imageable.filter((p) => supports(p, QuestionType.PICTURE_TO_PICTURE));
  if (picturePool.length < MIN_POOL) picturePool = getActivePairs({ types: [QuestionType.PICTURE_TO_PICTURE] }).filter(hasImages);

  const poolFor = (t: QuestionType): WordPairContent[] => {
    if (t === QuestionType.PICTURE_TO_PICTURE) return picturePool;
    const b = t === QuestionType.CHOOSE_IMAGE ? imageable : pairs;
    const s = b.filter((p) => supports(p, t));
    return s.length >= (t === QuestionType.MATCH_PAIRS ? MATCH_PAIRS_PER_QUESTION : 1) ? s : [];
  };
  let active = types.filter((t) => {
    if (t === QuestionType.CHOOSE_IMAGE) return imageable.length >= MIN_POOL && poolFor(t).length > 0;
    if (t !== QuestionType.PICTURE_TO_PICTURE && pairs.length < MIN_POOL) return false;
    return poolFor(t).length > 0;
  });
  if (active.length === 0) active = [QuestionType.CHOOSE_OPPOSITE];

  const total = settings.questionCount;
  const treasureCount = settings.treasureChallenge ? Math.min(TREASURE_QUESTIONS, total) : 0;
  const regular = total - treasureCount;
  let treasureTypes = active.filter((t) => t !== QuestionType.MATCH_PAIRS);
  if (treasureTypes.length === 0) treasureTypes = [QuestionType.CHOOSE_OPPOSITE];
  const sequence = [...evenTypeMix(active, regular, rng), ...evenTypeMix(treasureTypes, treasureCount, rng)];
  const deck = new Deck(rng);
  const timeLimitMs = Math.max(0, settings.timePerQuestionSec) * 1000;
  const treasureStart = sequence.length - treasureCount;

  return sequence.map((type, index) => {
    let spec: Spec;
    switch (type) {
      case QuestionType.CHOOSE_IMAGE:
        spec = chooseImage(deck.take(poolFor(type) as ImagedPair[]), imageable, rng);
        break;
      case QuestionType.PICTURE_TO_PICTURE:
        spec = pictureToPicture(deck.take(picturePool), picturePool, pairs, rng);
        break;
      case QuestionType.MATCH_PAIRS:
        spec = matchPairs(deck.takeMany(poolFor(type), MATCH_PAIRS_PER_QUESTION), rng);
        break;
      case QuestionType.COMPLETE_SENTENCE:
        spec = completeSentence(deck.take(poolFor(type)), pairs, rng);
        break;
      default:
        spec = chooseOpposite(deck.take(poolFor(QuestionType.CHOOSE_OPPOSITE).length ? poolFor(QuestionType.CHOOSE_OPPOSITE) : pairs), pairs, rng);
    }
    const isTreasure = index >= treasureStart;
    return { ...spec, index, isTreasure, ...(isTreasure ? { treasureStep: index - treasureStart + 1 } : {}), timeLimitMs };
  });
}

/** תצוגת שאלה ללקוח – ללא מידע על נכונות (כמו בשרת) */
export function toView(q: DemoQuestion, total: number, startedAt: number): QuestionView {
  const view: QuestionView = {
    sessionQuestionId: q.id,
    index: q.index,
    total,
    type: q.type,
    prompt: q.prompt,
    ...(q.promptImage ? { promptImage: q.promptImage } : {}),
    options: q.options.map((o) => ({ id: o.id, text: o.text, ...(o.image ? { image: o.image } : {}) })),
    isTreasure: q.isTreasure,
    ...(q.isTreasure && q.treasureStep ? { treasureStep: q.treasureStep, treasureTotal: TREASURE_QUESTIONS } : {}),
    timeLimitMs: q.timeLimitMs,
    startedAt,
    endsAt: q.timeLimitMs > 0 ? startedAt + q.timeLimitMs : null,
    serverNow: Date.now(),
  };
  if (q.cards && q.pairs) {
    view.matchCards = q.cards.map((c) => ({ ...c }));
    view.matchPairsCount = q.pairs.length;
  }
  return view;
}
