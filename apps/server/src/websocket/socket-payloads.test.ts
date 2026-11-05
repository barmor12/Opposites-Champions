import { describe, expect, it } from 'vitest';
import {
  MAX_MATCHES_PER_ANSWER, parseAnswerPayload, parseQuestionNextPayload, parseRoomIdPayload, parseSessionTokenPayload,
} from './socket-payloads';
import { generateSessionToken } from '../players/player-token';

const SQ = '0b1c6d3e-5f7a-4b8c-9d0e-1f2a3b4c5d6e';
const OPT = '1b1c6d3e-5f7a-4b8c-9d0e-1f2a3b4c5d6f';
const ROOM = '2b1c6d3e-5f7a-4b8c-9d0e-1f2a3b4c5d60';

describe('parseAnswerPayload (socket whitelist)', () => {
  it('accepts a choice answer and returns only the whitelisted fields', () => {
    expect(parseAnswerPayload({ sessionQuestionId: SQ, optionId: OPT })).toEqual({ sessionQuestionId: SQ, optionId: OPT });
  });

  it('accepts a match answer (mistakes optional, UX-only)', () => {
    const matches = [{ cardA: 'abc', cardB: 'def' }];
    expect(parseAnswerPayload({ sessionQuestionId: SQ, matches })).toEqual({ sessionQuestionId: SQ, matches, mistakes: 0 });
    expect(parseAnswerPayload({ sessionQuestionId: SQ, matches, mistakes: 2 })).toEqual({ sessionQuestionId: SQ, matches, mistakes: 2 });
  });

  it('rejects client-provided score/result fields (unknown keys)', () => {
    for (const extra of [{ score: 9999 }, { scoreAwarded: 1 }, { isCorrect: true }, { elapsedMs: 0 }, { correct: true }]) {
      expect(() => parseAnswerPayload({ sessionQuestionId: SQ, optionId: OPT, ...extra })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    }
  });

  it('rejects non-objects, missing ids, non-uuid ids and mixed shapes', () => {
    for (const raw of [null, undefined, 'x', 42, [], { optionId: OPT }, { sessionQuestionId: 'nope', optionId: OPT }, { sessionQuestionId: SQ, optionId: 'nope' }]) {
      expect(() => parseAnswerPayload(raw)).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    }
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, optionId: OPT, matches: [] })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, optionId: OPT, mistakes: 1 })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
  });

  it('bounds the matches array and card id lengths', () => {
    const tooMany = Array.from({ length: MAX_MATCHES_PER_ANSWER + 1 }, (_, i) => ({ cardA: `a${i}`, cardB: `b${i}` }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, matches: tooMany })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, matches: [{ cardA: 'x'.repeat(40), cardB: 'b' }] })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, matches: [{ cardA: '', cardB: 'b' }] })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, matches: [{ cardA: 'a', cardB: 'b', extra: 1 }] })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, matches: [{ cardA: 1, cardB: 'b' }] })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, matches: 'abc' })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, matches: [], mistakes: -1 })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseAnswerPayload({ sessionQuestionId: SQ, matches: [], mistakes: 1.5 })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
  });
});

describe('other socket payloads', () => {
  it('question:next accepts an optional uuid only', () => {
    expect(parseQuestionNextPayload(undefined)).toBeUndefined();
    expect(parseQuestionNextPayload({})).toBeUndefined();
    expect(parseQuestionNextPayload({ sessionQuestionId: SQ })).toBe(SQ);
    expect(() => parseQuestionNextPayload({ sessionQuestionId: 'nope' })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseQuestionNextPayload({ sessionQuestionId: SQ, score: 1 })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseQuestionNextPayload('x')).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
  });

  it('teacher:join requires a uuid roomId', () => {
    expect(parseRoomIdPayload({ roomId: ROOM })).toBe(ROOM);
    expect(() => parseRoomIdPayload({ roomId: 'x' })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseRoomIdPayload({})).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseRoomIdPayload({ roomId: ROOM, teacherId: 'me' })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
  });

  it('player:join requires a well-formed session token', () => {
    const token = generateSessionToken();
    expect(parseSessionTokenPayload({ sessionToken: token })).toBe(token);
    expect(() => parseSessionTokenPayload({ sessionToken: 'short' })).toThrow(expect.objectContaining({ code: 'INVALID_TOKEN' }));
    expect(() => parseSessionTokenPayload({ sessionToken: `${token}!` })).toThrow(expect.objectContaining({ code: 'INVALID_TOKEN' }));
    expect(() => parseSessionTokenPayload({ sessionToken: token, role: 'teacher' })).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
    expect(() => parseSessionTokenPayload(null)).toThrow(expect.objectContaining({ code: 'INVALID_PAYLOAD' }));
  });
});
