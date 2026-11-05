import type { IncomingMessage } from 'node:http';
import type { Options as PinoHttpOptions } from 'pino-http';

/**
 * pino-http options – one place to review what reaches the logs.
 * Policy: no cookies, no tokens, no bodies, no IPs, no student names. Room codes in URLs are masked.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-player-token"]',
  'res.headers["set-cookie"]',
  'req.body',
  'req.body.password',
  'req.query',
] as const;

const ROOM_CODE_RE = /(\/rooms\/)\d{6}(?=\/|\?|$)/;

/** Masks the 6-digit room code in `/api/rooms/:code` and strips query strings. */
export function sanitizeUrlForLog(url: string | undefined): string | undefined {
  if (!url) return url;
  const noQuery = url.split('?')[0] ?? url;
  return noQuery.replace(ROOM_CODE_RE, '$1:code');
}

export interface LoggingConfig {
  logLevel: string;
  isProd: boolean;
}

export function buildPinoHttpOptions(config: LoggingConfig): PinoHttpOptions {
  return {
    level: config.logLevel,
    transport: config.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss' } },
    redact: { paths: [...LOG_REDACT_PATHS], censor: '[redacted]' },
    // Minimal serializers – no IPs, headers or bodies (no PII).
    serializers: {
      req: (req: IncomingMessage & { id?: unknown }) => ({ id: req.id, method: req.method, url: sanitizeUrlForLog(req.url) }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
    },
    autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
    customProps: () => ({ app: 'oc-server' }),
  };
}
