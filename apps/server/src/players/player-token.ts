import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes → 43 base64url chars. Bounds below leave room for future longer tokens. */
export const SESSION_TOKEN_MIN_LENGTH = 32;
export const SESSION_TOKEN_MAX_LENGTH = 128;
const SESSION_TOKEN_RE = /^[A-Za-z0-9_-]+$/;

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 hex – only the hash is stored (GameParticipant.sessionTokenHash, unique → lookup by hash). */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Cheap syntactic check before touching the database: base64url alphabet and length bounds.
 * Rejects garbage/oversized values early (no hashing, no query).
 */
export function isSessionTokenFormat(token: unknown): token is string {
  return typeof token === 'string'
    && token.length >= SESSION_TOKEN_MIN_LENGTH
    && token.length <= SESSION_TOKEN_MAX_LENGTH
    && SESSION_TOKEN_RE.test(token);
}
