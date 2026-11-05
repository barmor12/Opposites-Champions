/**
 * Socket מדומה לגרסת הדמו – מממש את תת־הממשק של socket.io-client שהלקוח משתמש בו
 * (connect/disconnect/on/off/once/emit/removeAllListeners/io.on) ומנתב את האירועים למנוע הדמו.
 */
import type { AppSocket, SocketFactory } from '@/services/socket';
import { demoEngine } from './engine';

type Listener = (...args: unknown[]) => void;

class DemoSocket {
  connected = false;
  disconnected = true;
  id = 'demo-socket';
  readonly auth: Record<string, string>;
  private listeners = new Map<string, Set<Listener>>();
  readonly io = {
    on: (_event: string, _cb: Listener) => this.io,
    off: (_event?: string, _cb?: Listener) => this.io,
  };

  constructor(auth: Record<string, string>) {
    this.auth = auth;
    window.setTimeout(() => this.connect(), 40);
  }

  connect(): this {
    if (this.connected) return this;
    if (!demoEngine.isValidToken(this.auth.token)) {
      window.setTimeout(() => this.fire('connect_error', new Error('UNAUTHORIZED')), 10);
      return this;
    }
    this.connected = true;
    this.disconnected = false;
    demoEngine.attach((event, ...args) => this.fire(event, ...(args as unknown[])));
    this.fire('connect');
    return this;
  }

  disconnect(): this {
    if (!this.connected) return this;
    this.connected = false;
    this.disconnected = true;
    demoEngine.detach();
    this.fire('disconnect', 'io client disconnect');
    return this;
  }

  on(event: string, cb: Listener): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return this;
  }

  once(event: string, cb: Listener): this {
    const wrapped: Listener = (...args) => {
      this.off(event, wrapped);
      cb(...args);
    };
    return this.on(event, wrapped);
  }

  off(event?: string, cb?: Listener): this {
    if (!event) this.listeners.clear();
    else if (!cb) this.listeners.delete(event);
    else this.listeners.get(event)?.delete(cb);
    return this;
  }

  removeAllListeners(event?: string): this {
    return this.off(event);
  }

  emit(event: string, ...args: unknown[]): this {
    const ack = typeof args[args.length - 1] === 'function' ? (args.pop() as (r: unknown) => void) : undefined;
    // השהיה קטנה – מדמה רשת
    window.setTimeout(() => demoEngine.handle(event, args[0], ack), 60 + Math.random() * 90);
    return this;
  }

  private fire(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of [...set]) cb(...args);
  }
}

export const demoSocketFactory: SocketFactory = (auth) => new DemoSocket(auth) as unknown as AppSocket;
