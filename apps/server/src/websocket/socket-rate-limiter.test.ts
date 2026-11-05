import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter, socketClientIp } from './socket-rate-limiter';

describe('FixedWindowRateLimiter', () => {
  it('allows `limit` hits per window and blocks the rest until the window resets', () => {
    const limiter = new FixedWindowRateLimiter({ limit: 3, windowMs: 1000 });
    const t0 = 1_000_000;
    expect([limiter.hit('ip', t0), limiter.hit('ip', t0 + 10), limiter.hit('ip', t0 + 20)]).toEqual([true, true, true]);
    expect(limiter.hit('ip', t0 + 30)).toBe(false);
    expect(limiter.count('ip', t0 + 30)).toBe(4);
    // other keys are independent
    expect(limiter.hit('other', t0 + 30)).toBe(true);
    // window elapsed → fresh budget
    expect(limiter.hit('ip', t0 + 1001)).toBe(true);
    expect(limiter.count('ip', t0 + 1001)).toBe(1);
  });

  it('forget() drops a key eagerly (used on socket disconnect)', () => {
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.hit('s1', 0)).toBe(true);
    expect(limiter.hit('s1', 1)).toBe(false);
    limiter.forget('s1');
    expect(limiter.size).toBe(0);
    expect(limiter.hit('s1', 2)).toBe(true);
  });

  it('keeps memory bounded: expired windows are pruned and the key cap is enforced', () => {
    const limiter = new FixedWindowRateLimiter({ limit: 10, windowMs: 100, maxKeys: 5 });
    for (let i = 0; i < 50; i += 1) limiter.hit(`k${i}`, 0);
    expect(limiter.size).toBeLessThanOrEqual(5 + 1); // the cap is enforced on the prune pass that follows an overflow
    // all windows expired → next hit prunes everything else
    limiter.hit('fresh', 1000);
    expect(limiter.size).toBe(1);
    expect(limiter.count('k0', 1000)).toBe(0);
  });
});

describe('socketClientIp', () => {
  const handshake = (xff?: string | string[]): { address: string; headers: Record<string, string | string[] | undefined> } => ({
    address: '10.0.0.9',
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
  });

  it('ignores X-Forwarded-For when no proxy is trusted (spoof-proof by default)', () => {
    expect(socketClientIp(handshake('1.2.3.4'), 0)).toBe('10.0.0.9');
  });

  it('takes the n-th address from the right for n trusted hops (express semantics)', () => {
    expect(socketClientIp(handshake('1.2.3.4'), 1)).toBe('1.2.3.4');
    expect(socketClientIp(handshake('9.9.9.9, 1.2.3.4'), 1)).toBe('1.2.3.4'); // spoofed left-most entry ignored
    expect(socketClientIp(handshake('9.9.9.9, 1.2.3.4, 5.5.5.5'), 2)).toBe('1.2.3.4');
    expect(socketClientIp(handshake(['9.9.9.9', '1.2.3.4']), 1)).toBe('1.2.3.4');
    expect(socketClientIp(handshake(''), 1)).toBe('10.0.0.9');
    expect(socketClientIp(handshake(), 1)).toBe('10.0.0.9');
  });
});
