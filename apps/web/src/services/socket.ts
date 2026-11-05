import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, SocketAck } from '@oc/shared';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** שגיאת socket (ack שלילי / timeout) עם הודעה בעברית */
export class SocketError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SocketError';
    this.code = code;
  }
}

const SOCKET_URL: string | undefined = import.meta.env.VITE_SOCKET_URL || undefined;
const SOCKET_PATH = '/socket.io';

let socket: AppSocket | null = null;
let currentRole: 'player' | 'teacher' | null = null;
let serverOffsetMs = 0;
const offsetListeners = new Set<(offset: number) => void>();

function baseOptions() {
  return {
    path: SOCKET_PATH,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.4,
    timeout: 10_000,
    autoConnect: true,
  } as const;
}

function create(auth: Record<string, string>, role: 'player' | 'teacher'): AppSocket {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  const s: AppSocket = SOCKET_URL ? io(SOCKET_URL, { ...baseOptions(), auth }) : io({ ...baseOptions(), auth });
  currentRole = role;
  s.on('connect', () => {
    void syncClock(s);
  });
  socket = s;
  return s;
}

/** התחברות כתלמיד – ה־sessionToken נשלח ב־auth.token */
export function connectAsPlayer(token: string): AppSocket {
  if (socket && currentRole === 'player' && (socket.auth as { token?: string }).token === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  return create({ token }, 'player');
}

/** התחברות כמורה – אימות דרך cookie oc_teacher */
export function connectAsTeacher(): AppSocket {
  if (socket && currentRole === 'teacher') {
    if (!socket.connected) socket.connect();
    return socket;
  }
  return create({}, 'teacher');
}

export function getSocket(): AppSocket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  currentRole = null;
}

// ===== Ack helper =====
type AckEvents = {
  [K in keyof ClientToServerEvents]: Parameters<ClientToServerEvents[K]>[1] extends (r: SocketAck<unknown>) => void ? K : never;
}[keyof ClientToServerEvents];
type PayloadOf<E extends AckEvents> = Parameters<ClientToServerEvents[E]>[0];
type AckArg<E extends AckEvents> = Parameters<Parameters<ClientToServerEvents[E]>[1]>[0];
export type AckData<E extends AckEvents> = AckArg<E> extends SocketAck<infer T> ? T : never;

/** שולח אירוע עם ack ומחזיר Promise; דוחה ב־SocketError על ok:false או timeout */
export function emitWithAck<E extends AckEvents>(
  s: AppSocket,
  event: E,
  payload: PayloadOf<E>,
  timeoutMs = 8000,
): Promise<AckData<E>> {
  return new Promise((resolve, reject) => {
    if (!s.connected) {
      reject(new SocketError('DISCONNECTED', 'אין חיבור למשחק. מנסים להתחבר מחדש…'));
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new SocketError('TIMEOUT', 'השרת לא ענה בזמן. נסו שוב'));
    }, timeoutMs);
    const emit = s.emit as unknown as (ev: E, p: PayloadOf<E>, ack: (r: SocketAck<AckData<E>>) => void) => void;
    emit.call(s, event, payload, (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (r && r.ok) resolve(r.data);
      else reject(new SocketError(r?.error?.code ?? 'UNKNOWN', r?.error?.message ?? 'אופס! משהו השתבש'));
    });
  });
}

// ===== Clock sync =====
function pingOnce(s: AppSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    const sentAt = Date.now();
    const timer = setTimeout(() => reject(new Error('ping timeout')), 3000);
    s.emit('time:ping', sentAt, (serverNow) => {
      clearTimeout(timer);
      const receivedAt = Date.now();
      const rtt = receivedAt - sentAt;
      resolve(serverNow - (sentAt + rtt / 2));
    });
  });
}

/** הערכת הפרש שעון בין השרת ללקוח (חציון של מספר דגימות) */
export async function syncClock(s: AppSocket, samples = 3): Promise<number> {
  const results: number[] = [];
  for (let i = 0; i < samples; i++) {
    try {
      results.push(await pingOnce(s));
    } catch {
      /* ignore single failures */
    }
  }
  if (results.length) {
    results.sort((a, b) => a - b);
    const mid = Math.floor(results.length / 2);
    const median = results.length % 2 ? results[mid]! : (results[mid - 1]! + results[mid]!) / 2;
    setServerOffset(Math.round(median));
  }
  return serverOffsetMs;
}

export function setServerOffset(offset: number): void {
  serverOffsetMs = offset;
  offsetListeners.forEach((cb) => cb(offset));
}

export function getServerOffsetMs(): number {
  return serverOffsetMs;
}

/** זמן השרת המשוער כרגע */
export function serverNow(): number {
  return Date.now() + serverOffsetMs;
}

export function onServerOffsetChange(cb: (offset: number) => void): () => void {
  offsetListeners.add(cb);
  return () => offsetListeners.delete(cb);
}
