import type { Prisma } from '@prisma/client';
import type { MatchCardView } from '@oc/shared';

export interface ChoicePayload {
  kind: 'choice';
  pairId: string;
  word: string;
  opposite: string;
}

export interface MatchPair {
  cardA: string;
  cardB: string;
}

export interface MatchPayload {
  kind: 'match';
  pairIds: string[];
  cards: MatchCardView[]; // כבר מעורבבים – כך הצגה חוזרת זהה
  pairs: MatchPair[]; // ההתאמות הנכונות – לעולם לא נשלחות ללקוח לפני סגירה
}

export type QuestionPayload = ChoicePayload | MatchPayload;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseQuestionPayload(json: Prisma.JsonValue): QuestionPayload {
  if (!isRecord(json)) return { kind: 'choice', pairId: '', word: '', opposite: '' };
  if (json.kind === 'match') {
    const cards = Array.isArray(json.cards)
      ? json.cards.filter(isRecord).map((c): MatchCardView => ({
          id: String(c.id ?? ''),
          text: String(c.text ?? ''),
          ...(typeof c.image === 'string' ? { image: c.image } : {}),
        }))
      : [];
    const pairs = Array.isArray(json.pairs)
      ? json.pairs.filter(isRecord).map((p): MatchPair => ({ cardA: String(p.cardA ?? ''), cardB: String(p.cardB ?? '') }))
      : [];
    const pairIds = Array.isArray(json.pairIds) ? json.pairIds.map(String) : [];
    return { kind: 'match', cards, pairs, pairIds };
  }
  return {
    kind: 'choice',
    pairId: String(json.pairId ?? ''),
    word: String(json.word ?? ''),
    opposite: String(json.opposite ?? ''),
  };
}

export function payloadToJson(payload: QuestionPayload): Prisma.InputJsonObject {
  return { ...payload } as unknown as Prisma.InputJsonObject;
}

/** מפתח קנוני לזוג קלפים (ללא תלות בסדר) */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
