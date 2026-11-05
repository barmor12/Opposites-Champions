import { describe, expect, it } from 'vitest';
import { generateSessionToken, hashSessionToken, isSessionTokenFormat, SESSION_TOKEN_MAX_LENGTH } from './player-token';

describe('session tokens', () => {
  it('generates 32 random bytes as base64url (43 chars) – unique per call', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateSessionToken()));
    expect(tokens.size).toBe(200);
    for (const t of tokens) {
      expect(t).toHaveLength(43);
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(isSessionTokenFormat(t)).toBe(true);
    }
  });

  it('hashes deterministically with sha256 (hex) – the raw token is never what is stored', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashSessionToken(token));
    expect(hash).not.toContain(token);
    expect(hashSessionToken(`${token}x`)).not.toBe(hash);
  });

  it('rejects malformed tokens before any lookup (type, length bounds, alphabet)', () => {
    expect(isSessionTokenFormat(undefined)).toBe(false);
    expect(isSessionTokenFormat(null)).toBe(false);
    expect(isSessionTokenFormat(42)).toBe(false);
    expect(isSessionTokenFormat('')).toBe(false);
    expect(isSessionTokenFormat('bogus')).toBe(false);
    expect(isSessionTokenFormat('a'.repeat(31))).toBe(false);
    expect(isSessionTokenFormat('a'.repeat(32))).toBe(true);
    expect(isSessionTokenFormat('a'.repeat(SESSION_TOKEN_MAX_LENGTH))).toBe(true);
    expect(isSessionTokenFormat('a'.repeat(SESSION_TOKEN_MAX_LENGTH + 1))).toBe(false);
    expect(isSessionTokenFormat(`${'a'.repeat(40)}+/=`)).toBe(false);
    expect(isSessionTokenFormat(`${'a'.repeat(40)} `)).toBe(false);
  });
});
