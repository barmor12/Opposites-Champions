import { type INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { SESSION_TOKEN_HEADER } from '@oc/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { CSRF_HEADER } from './auth/auth.constants';

export const GLOBAL_PREFIX = 'api';

export interface AppSetupOptions {
  corsOrigins: string[];
  cookieSecret: string;
  isProd: boolean;
  /** Enable helmet/trust-proxy (not needed in in-process tests). */
  http?: boolean;
}

/** Shared HTTP pipeline for main.ts and integration tests. */
export function setupApp(app: INestApplication, opts: AppSetupOptions): void {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  if (opts.http !== false) {
    const express = app as NestExpressApplication;
    express.set('trust proxy', 1);
    express.disable('x-powered-by');
    app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
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
