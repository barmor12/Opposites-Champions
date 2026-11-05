import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BadRequestException, Logger, type ArgumentsHost } from '@nestjs/common';
import { clientHttpStatus, HttpExceptionFilter, normaliseMessage } from './http-exception.filter';
import { GameError } from '../games/game-error';

beforeAll(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

function run(exception: unknown): { status: number; body: unknown } {
  const result = { status: 0, body: undefined as unknown };
  const res = {
    headersSent: false,
    status: vi.fn((s: number) => { result.status = s; return res; }),
    json: vi.fn((b: unknown) => { result.body = b; }),
  };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'POST', url: '/api/x' }) }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return result;
}

describe('clientHttpStatus (express/body-parser errors)', () => {
  it('recognises 4xx http-errors by status or statusCode', () => {
    expect(clientHttpStatus({ status: 413, type: 'entity.too.large' })).toBe(413);
    expect(clientHttpStatus({ statusCode: 400, type: 'entity.parse.failed' })).toBe(400);
    expect(clientHttpStatus({ status: 500 })).toBeNull();
    expect(clientHttpStatus(new Error('boom'))).toBeNull();
    expect(clientHttpStatus(null)).toBeNull();
    expect(clientHttpStatus({ status: '413' })).toBeNull();
  });
});

describe('HttpExceptionFilter', () => {
  it('maps a body-parser 413 to a Hebrew JSON error without leaking the internal message', () => {
    const err = Object.assign(new Error('request entity too large'), { status: 413, type: 'entity.too.large', expose: true });
    const out = run(err);
    expect(out.status).toBe(413);
    expect(out.body).toEqual({ statusCode: 413, message: 'הבקשה גדולה מדי', error: 'Payload Too Large' });
  });

  it('maps malformed JSON (400 entity.parse.failed) to a generic Hebrew 400', () => {
    const err = Object.assign(new SyntaxError('Unexpected token } in JSON at position 12'), { status: 400, type: 'entity.parse.failed' });
    const out = run(err);
    expect(out.status).toBe(400);
    expect((out.body as { message: string }).message).toBe('הבקשה אינה תקינה');
    expect(JSON.stringify(out.body)).not.toContain('Unexpected token');
  });

  it('hides internals for unknown errors (500) and keeps GameError codes', () => {
    const internal = run(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    expect(internal.status).toBe(500);
    expect(internal.body).toEqual({ statusCode: 500, message: 'אירעה שגיאה, נסו שוב מאוחר יותר', error: 'Internal Server Error' });
    expect(JSON.stringify(internal.body)).not.toContain('5432');

    const game = run(GameError.forbidden('NOT_OWNER', 'אין לך הרשאה למשחק זה'));
    expect(game.status).toBe(403);
    expect(game.body).toEqual({ statusCode: 403, message: 'אין לך הרשאה למשחק זה', error: 'NOT_OWNER' });
  });

  it('normalises Nest/class-validator defaults to Hebrew', () => {
    expect(normaliseMessage(400, 'property score should not exist')).toBe('שדה לא מוכר: score');
    expect(normaliseMessage(404, 'Cannot GET /api/nope')).toBe('הנתיב המבוקש לא קיים');
    expect(normaliseMessage(429, 'ThrottlerException: Too Many Requests')).toBe('יותר מדי בקשות, נסו שוב בעוד רגע');
    expect(normaliseMessage(400, ['יש להזין שם', 'competitionEnabled must be a boolean value'])).toBe('יש להזין שם');
  });

  it('never echoes non-Hebrew (library/parser) text – e.g. Nest-wrapped body-parser SyntaxError', () => {
    const out = run(new BadRequestException('Unexpected end of JSON input'));
    expect(out.status).toBe(400);
    expect(out.body).toEqual({ statusCode: 400, message: 'הבקשה אינה תקינה', error: 'Bad Request' });
    expect(normaliseMessage(400, 'Unexpected token } in JSON at position 12')).toBe('הבקשה אינה תקינה');
    expect(normaliseMessage(500, 'connect ECONNREFUSED 10.0.0.5:5432')).toBe('אירעה שגיאה, נסו שוב מאוחר יותר');
  });
});
