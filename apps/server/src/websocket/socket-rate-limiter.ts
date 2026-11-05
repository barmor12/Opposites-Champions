/**
 * Small fixed-window rate limiter for the Socket.IO layer (handshakes per IP, events per socket).
 * Memory is bounded: expired windows are pruned on each call once per window, and `forget` removes
 * a key eagerly (on disconnect). No timers – nothing to leak.
 */
export interface RateLimiterOptions {
  /** Max hits per window. */
  limit: number;
  /** Window length in ms. */
  windowMs: number;
  /** Hard cap on tracked keys; when exceeded the oldest windows are dropped first. */
  maxKeys?: number;
}

interface Window {
  count: number;
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();
  private lastPruneAt = 0;
  private readonly maxKeys: number;

  constructor(private readonly options: RateLimiterOptions) {
    this.maxKeys = options.maxKeys ?? 10_000;
  }

  /** Records a hit and returns `true` when the key is still within its limit. */
  hit(key: string, now = Date.now()): boolean {
    this.pruneIfDue(now);
    let win = this.windows.get(key);
    if (!win || win.resetAt <= now) {
      win = { count: 0, resetAt: now + this.options.windowMs };
      this.windows.set(key, win);
    }
    win.count += 1;
    return win.count <= this.options.limit;
  }

  /** Current hit count for a key (0 when unknown/expired). */
  count(key: string, now = Date.now()): number {
    const win = this.windows.get(key);
    return win && win.resetAt > now ? win.count : 0;
  }

  forget(key: string): void {
    this.windows.delete(key);
  }

  get size(): number {
    return this.windows.size;
  }

  clear(): void {
    this.windows.clear();
  }

  private pruneIfDue(now: number): void {
    const due = now - this.lastPruneAt >= this.options.windowMs || this.windows.size > this.maxKeys;
    if (!due) return;
    this.lastPruneAt = now;
    for (const [key, win] of this.windows) {
      if (win.resetAt <= now) this.windows.delete(key);
    }
    // Still over the cap (burst of distinct keys inside one window): drop the oldest entries.
    if (this.windows.size > this.maxKeys) {
      const excess = this.windows.size - this.maxKeys;
      let dropped = 0;
      for (const key of this.windows.keys()) {
        if (dropped >= excess) break;
        this.windows.delete(key);
        dropped += 1;
      }
    }
  }
}

/**
 * Resolves the client IP of a socket handshake. When `trustProxyHops` > 0 the X-Forwarded-For
 * header is honoured (same semantics as express `trust proxy: <n>`: the n-th address from the right).
 */
export function socketClientIp(
  handshake: { address: string; headers: Record<string, string | string[] | undefined> },
  trustProxyHops: number,
): string {
  if (trustProxyHops <= 0) return handshake.address;
  const raw = handshake.headers['x-forwarded-for'];
  const header = Array.isArray(raw) ? raw.join(',') : raw;
  if (!header) return handshake.address;
  const chain = header.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (chain.length === 0) return handshake.address;
  const idx = Math.max(0, chain.length - trustProxyHops);
  return chain[idx] ?? handshake.address;
}
