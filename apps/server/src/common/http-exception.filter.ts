import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { STATUS_CODES } from 'node:http';
import { HE, hebrewMessageForStatus, isEnglishDefaultMessage } from './hebrew-messages';

export interface ErrorBody {
  statusCode: number;
  message: string;
  error: string;
}

const UNKNOWN_FIELD_RE = /^property (\S+) should not exist$/;
const ROUTE_NOT_FOUND_RE = /^Cannot [A-Z]+ \//;

/** Normalises Nest/class-validator messages into one short Hebrew string. */
export function normaliseMessage(status: number, raw: unknown): string {
  const list = Array.isArray(raw) ? raw : [raw];
  const parts = list
    .filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    .map((m) => {
      const unknown = UNKNOWN_FIELD_RE.exec(m);
      if (unknown?.[1]) return HE.unknownField(unknown[1]);
      if (ROUTE_NOT_FOUND_RE.test(m)) return HE.routeNotFound;
      return m;
    })
    .filter((m) => !isEnglishDefaultMessage(m));
  if (parts.length === 0) return hebrewMessageForStatus(status);
  return parts.join(', ');
}

/** Global filter: `{ statusCode, message, error }` with Hebrew messages; logs 5xx. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string = HE.internal;
    let error: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = normaliseMessage(status, body);
      } else if (typeof body === 'object' && body !== null) {
        const b = body as { message?: unknown; error?: unknown };
        message = normaliseMessage(status, b.message ?? exception.message);
        if (typeof b.error === 'string') error = b.error;
      }
    } else if (isPrismaKnownError(exception)) {
      // Unique constraint → 409; record not found → 404
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = HE.conflict;
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = HE.notFound;
      }
    } else if (isClientHttpError(exception)) {
      // body-parser / http-errors (413 entity.too.large, 400 entity.parse.failed, …) – never expose the raw message
      status = exception.status;
      message = hebrewMessageForStatus(status);
    }
    error ??= STATUS_CODES[status] ?? 'Error';

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`${req.method} ${req.url} -> ${status}: ${err.message}`, err.stack);
      message = HE.internal;
    }

    const payload: ErrorBody = { statusCode: status, message, error };
    if (res.headersSent) return;
    res.status(status).json(payload);
  }
}

function isPrismaKnownError(e: unknown): e is { code: string; message: string } {
  return typeof e === 'object' && e !== null && 'code' in e && typeof (e as { code: unknown }).code === 'string'
    && (e as { name?: unknown }).name === 'PrismaClientKnownRequestError';
}
