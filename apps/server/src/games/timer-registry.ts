import { Injectable, type OnModuleDestroy } from '@nestjs/common';

export type TimerKind = 'countdown' | 'question';

/**
 * רישום טיימרים לפי sessionId. הטיימרים עצמם נגזרים מחותמות זמן במסד הנתונים,
 * ולכן ניתן לשחזר אותם אחרי הפעלה מחדש של השרת (ראו GamesService.rearmTimers).
 */
@Injectable()
export class TimerRegistry implements OnModuleDestroy {
  private readonly timers = new Map<string, Map<TimerKind, NodeJS.Timeout>>();

  set(sessionId: string, kind: TimerKind, delayMs: number, fn: () => void): void {
    this.clear(sessionId, kind);
    const timer = setTimeout(() => {
      this.timers.get(sessionId)?.delete(kind);
      fn();
    }, Math.max(0, delayMs));
    let bucket = this.timers.get(sessionId);
    if (!bucket) {
      bucket = new Map();
      this.timers.set(sessionId, bucket);
    }
    bucket.set(kind, timer);
  }

  clear(sessionId: string, kind?: TimerKind): void {
    const bucket = this.timers.get(sessionId);
    if (!bucket) return;
    if (kind) {
      const t = bucket.get(kind);
      if (t) clearTimeout(t);
      bucket.delete(kind);
    } else {
      for (const t of bucket.values()) clearTimeout(t);
      bucket.clear();
    }
    if (bucket.size === 0) this.timers.delete(sessionId);
  }

  has(sessionId: string, kind: TimerKind): boolean {
    return this.timers.get(sessionId)?.has(kind) ?? false;
  }

  onModuleDestroy(): void {
    for (const sessionId of [...this.timers.keys()]) this.clear(sessionId);
  }
}
