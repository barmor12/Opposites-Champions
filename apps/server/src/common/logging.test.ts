import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { buildPinoHttpOptions, LOG_REDACT_PATHS, sanitizeUrlForLog } from './logging';

describe('request logging hygiene', () => {
  it('redacts cookies, auth headers, the player token header, set-cookie and bodies', () => {
    const paths = [...LOG_REDACT_PATHS];
    expect(paths).toEqual(expect.arrayContaining([
      'req.headers.cookie', 'req.headers.authorization', 'req.headers["x-player-token"]', 'res.headers["set-cookie"]', 'req.body', 'req.query',
    ]));
    const options = buildPinoHttpOptions({ logLevel: 'info', isProd: true });
    expect(options.redact).toEqual({ paths, censor: '[redacted]' });
    expect(options.transport).toBeUndefined();
  });

  it('serialises requests to id/method/url only – no headers, IPs, bodies or student names', () => {
    const options = buildPinoHttpOptions({ logLevel: 'info', isProd: true });
    const serializers = options.serializers as { req: (r: unknown) => Record<string, unknown>; res: (r: unknown) => Record<string, unknown> };
    const req = {
      id: 7, method: 'POST', url: '/api/rooms/join?x=1', headers: { cookie: 'oc_teacher=secret', 'x-player-token': 'tok' },
      socket: { remoteAddress: '1.2.3.4' }, body: { displayName: 'דנה', code: '123456' },
    } as unknown as IncomingMessage;
    const out = serializers.req(req);
    expect(out).toEqual({ id: 7, method: 'POST', url: '/api/rooms/join' });
    expect(JSON.stringify(out)).not.toMatch(/secret|tok|1\.2\.3\.4|דנה|123456/);
    expect(serializers.res({ statusCode: 201, headers: { 'set-cookie': 'x' } })).toEqual({ statusCode: 201 });
  });

  it('masks room codes in URLs and strips query strings', () => {
    expect(sanitizeUrlForLog('/api/rooms/482913')).toBe('/api/rooms/:code');
    expect(sanitizeUrlForLog('/api/rooms/482913?x=1')).toBe('/api/rooms/:code');
    expect(sanitizeUrlForLog('/api/games/abc/results?sessionId=1')).toBe('/api/games/abc/results');
    expect(sanitizeUrlForLog('/api/rooms/join')).toBe('/api/rooms/join');
    expect(sanitizeUrlForLog(undefined)).toBeUndefined();
  });

  it('skips the health endpoint', () => {
    const options = buildPinoHttpOptions({ logLevel: 'info', isProd: false });
    const ignore = (options.autoLogging as { ignore: (req: IncomingMessage) => boolean }).ignore;
    expect(ignore({ url: '/api/health' } as IncomingMessage)).toBe(true);
    expect(ignore({ url: '/api/games' } as IncomingMessage)).toBe(false);
  });
});
