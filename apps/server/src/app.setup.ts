import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { SESSION_TOKEN_HEADER } from '@oc/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { CSRF_HEADER } from './auth/auth.constants';

export const GLOBAL_PREFIX = 'api';
/** Largest legitimate body is a word-pair create (~2KB) / game settings (~1KB). */
export const BODY_LIMIT = '64kb';

export interface AppSetupOptions {
  corsOrigins: string[];
  cookieSecret: string;
  isProd: boolean;
  /** Enable helmet/trust-proxy (not needed in in-process tests). */
  http?: boolean;
  /** Reverse-proxy hops to trust for X-Forwarded-* (0 = none). Only used when `http !== false`. */
  trustProxyHops?: number;
  /** Override the JSON/urlencoded body size limit (tests). */
  bodyLimit?: string;
}

/**
 * Shared HTTP pipeline for main.ts and integration tests.
 * main.ts creates the app with `bodyParser: false`, so the size-limited parsers registered here are the only
 * ones; test apps keep Nest's default parser, which is registered later and skips bodies already parsed.
 */
export function setupApp(app: INestApplication, opts: AppSetupOptions): void {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  const express = app as Partial<NestExpressApplication> & INestApplication;
  if (opts.http !== false) {
    const hops = opts.trustProxyHops ?? (opts.isProd ? 1 : 0);
    express.set?.('trust proxy', hops > 0 ? hops : false);
    express.disable?.('x-powered-by');
    // API-only server: helmet defaults (no sniff, frameguard, referrer policy, restrictive CSP for any HTML error page).
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  }
  const limit = opts.bodyLimit ?? BODY_LIMIT;
  if (typeof express.useBodyParser === 'function') {
    express.useBodyParser('json', { limit });
    express.useBodyParser('urlencoded', { limit, extended: false });
  }
  app.use(cookieParser(opts.cookieSecret));
  app.enableCors({
    origin: opts.corsOrigins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', CSRF_HEADER, SESSION_TOKEN_HEADER],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
