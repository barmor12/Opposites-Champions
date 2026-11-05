import type { AnswerPayload } from '@oc/shared';
import { GameError } from '../games/game-error';
import { isSessionTokenFormat } from '../players/player-token';

/**
 * Strict, whitelist-based validation of Socket.IO payloads (the HTTP ValidationPipe does not run here).
 * Every unknown key, wrong type or oversized value is rejected with INVALID_PAYLOAD – clients can never
 * smuggle score fields, giant arrays or non-string ids into the scoring path.
 */

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Match cards are 10-char random ids; a small ceiling keeps the per-answer work bounded. */
export const MAX_MATCH_CARD_ID_LENGTH = 32;
/** A match question has MATCH_PAIRS_PER_QUESTION (4) pairs; allow some slack for client-side retries, never more. */
export const MAX_MATCHES_PER_ANSWER = 16;
export const MAX_SOCKET_PAYLOAD_KEYS = 8;

const invalid = (message = 'הנתונים שנשלחו אינם תקינים'): GameError => GameError.badRequest('INVALID_PAYLOAD', message);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Throws when `raw` is not a plain object or contains keys outside `allowed`. */
function requireObject(raw: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!isRecord(raw)) throw invalid();
  const keys = Object.keys(raw);
  if (keys.length > MAX_SOCKET_PAYLOAD_KEYS) throw invalid();
  for (const key of keys) {
    if (!allowed.includes(key)) throw invalid(`שדה לא מוכר: ${key.slice(0, 32)}`);
  }
  return raw;
}

function requireUuid(value: unknown, message: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw invalid(message);
  return value;
}

/** `{ sessionToken }` for player:join. */
export function parseSessionTokenPayload(raw: unknown): string {
  const body = requireObject(raw, ['sessionToken']);
  if (!isSessionTokenFormat(body.sessionToken)) throw GameError.badRequest('INVALID_TOKEN', 'אסימון ההתחברות אינו תקין');
  return body.sessionToken;
}

/** `{ sessionQuestionId? }` for question:next (optional – a missing id means "advance from wherever I am"). */
export function parseQuestionNextPayload(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const body = requireObject(raw, ['sessionQuestionId']);
  if (body.sessionQuestionId === undefined) return undefined;
  return requireUuid(body.sessionQuestionId, 'מזהה השאלה אינו תקין');
}

/** `{ roomId }` for teacher:join. */
export function parseRoomIdPayload(raw: unknown): string {
  const body = requireObject(raw, ['roomId']);
  return requireUuid(body.roomId, 'מזהה החדר אינו תקין');
}

/**
 * AnswerPayload for answer:submit – exactly one of the two shapes:
 *  - `{ sessionQuestionId, optionId }`
 *  - `{ sessionQuestionId, matches: [{ cardA, cardB }], mistakes? }` (`mistakes` is UX-only and ignored by scoring)
 * No other keys (score, elapsedMs, isCorrect, …) are accepted.
 */
export function parseAnswerPayload(raw: unknown): AnswerPayload {
  const body = requireObject(raw, ['sessionQuestionId', 'optionId', 'matches', 'mistakes']);
  const sessionQuestionId = requireUuid(body.sessionQuestionId, 'מזהה השאלה אינו תקין');
  const hasOption = body.optionId !== undefined;
  const hasMatches = body.matches !== undefined;
  if (hasOption === hasMatches) throw invalid('יש לשלוח תשובה אחת בלבד');

  if (hasOption) {
    if (body.mistakes !== undefined) throw invalid();
    return { sessionQuestionId, optionId: requireUuid(body.optionId, 'התשובה שנבחרה אינה תקינה') };
  }

  if (!Array.isArray(body.matches)) throw invalid('תשובה לא תקינה לשאלת התאמה');
  if (body.matches.length > MAX_MATCHES_PER_ANSWER) throw invalid('נשלחו יותר מדי התאמות');
  const matches = body.matches.map((m): { cardA: string; cardB: string } => {
    const pair = requireObject(m, ['cardA', 'cardB']);
    const { cardA, cardB } = pair;
    if (typeof cardA !== 'string' || typeof cardB !== 'string') throw invalid('תשובה לא תקינה לשאלת התאמה');
    if (cardA.length === 0 || cardB.length === 0 || cardA.length > MAX_MATCH_CARD_ID_LENGTH || cardB.length > MAX_MATCH_CARD_ID_LENGTH) {
      throw invalid('תשובה לא תקינה לשאלת התאמה');
    }
    return { cardA, cardB };
  });
  const mistakes = body.mistakes === undefined ? 0 : body.mistakes;
  if (typeof mistakes !== 'number' || !Number.isInteger(mistakes) || mistakes < 0 || mistakes > 1000) throw invalid();
  return { sessionQuestionId, matches, mistakes };
}
