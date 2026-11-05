import { vi, type Mock } from 'vitest';
import type { PrismaService } from '../../prisma/prisma.service';

type AnyFn = (...args: never[]) => unknown;
export type MockModel = Record<string, Mock<AnyFn>>;

/**
 * Prisma mock מינימלי לבדיקות יחידה: כל מודל הוא אובייקט של vi.fn(),
 * ו־$transaction מריץ callback עם ה־mock עצמו (או מחזיר Promise.all על מערך).
 */
export function mockPrisma<M extends Record<string, MockModel>>(models: M): PrismaService & M {
  const base: Record<string, unknown> = { ...models };
  base.$transaction = vi.fn(async (arg: unknown) => {
    if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(base);
    return Promise.all(arg as Promise<unknown>[]);
  });
  return base as unknown as PrismaService & M;
}

export const p2002 = (): Error & { code: string } => {
  const err = new Error('Unique constraint failed') as Error & { code: string; clientVersion: string };
  err.code = 'P2002';
  err.clientVersion = 'test';
  Object.setPrototypeOf(err, PrismaKnownError.prototype);
  return err;
};

// Prisma.PrismaClientKnownRequestError נטען מתוך @prisma/client – משתמשים בו כדי ש־instanceof יעבוד
import { Prisma } from '@prisma/client';
const PrismaKnownError = Prisma.PrismaClientKnownRequestError;
