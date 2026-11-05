import { SESSION_TOKEN_HEADER } from '@oc/shared';
import { getPlayerToken } from '@/lib/storage';

export const API_BASE: string = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '');

/** שגיאת API אחידה עם הודעה בעברית */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
  }

  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export const DEFAULT_MESSAGES: Record<number, string> = {
  0: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב',
  400: 'משהו בפרטים לא תקין. בדקו ונסו שוב',
  401: 'צריך להתחבר כדי להמשיך',
  403: 'אין הרשאה לפעולה הזו',
  404: 'לא מצאנו את מה שחיפשתם',
  409: 'הפעולה כבר בוצעה',
  422: 'משהו בפרטים לא תקין',
  429: 'יותר מדי ניסיונות. חכו רגע ונסו שוב',
  500: 'אופס! משהו השתבש בשרת. נסו שוב בעוד רגע',
  502: 'השרת לא זמין כרגע. נסו שוב בעוד רגע',
  503: 'השרת לא זמין כרגע. נסו שוב בעוד רגע',
};

export const GENERIC_MESSAGE = 'אופס! משהו השתבש. נסו שוב';

interface NestErrorBody {
  statusCode?: number;
  message?: string | string[];
  error?: string;
  code?: string;
}

function extractMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const b = body as NestErrorBody;
    if (Array.isArray(b.message) && b.message.length) return b.message.join(', ');
    if (typeof b.message === 'string' && b.message.trim()) return b.message;
  }
  if (typeof body === 'string' && body.trim() && !body.trim().startsWith('<')) return body;
  return DEFAULT_MESSAGES[status] ?? GENERIC_MESSAGE;
}

export interface RequestOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** פרמטרים ל־query string */
  query?: Record<string, string | number | boolean | null | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

async function request<T>(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...options.headers,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getPlayerToken();
  if (token) headers[SESSION_TOKEN_HEADER] = token;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, DEFAULT_MESSAGES[0] ?? GENERIC_MESSAGE, { details: err });
  }

  const contentType = res.headers.get('content-type') ?? '';
  let payload: unknown = undefined;
  if (res.status !== 204) {
    const text = await res.text();
    if (text) {
      payload = contentType.includes('application/json') ? safeJson(text) : text;
    }
  }

  if (!res.ok) {
    const code = payload && typeof payload === 'object' ? (payload as NestErrorBody).code ?? (payload as NestErrorBody).error : undefined;
    throw new ApiError(res.status, extractMessage(payload, res.status), { code, details: payload });
  }
  return payload as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** לקוח HTTP מוקלד – כל הקריאות ל־/api עוברות דרכו */
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('POST', path, body ?? {}, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PATCH', path, body ?? {}, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>('PUT', path, body ?? {}, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, undefined, options),
  /** URL מלא (לקישורי הורדה כמו ייצוא CSV) */
  url: (path: string, query?: RequestOptions['query']) => buildUrl(path, query),
};

export type ApiClient = typeof apiClient;

/** האם שגיאה כלשהי היא ApiError עם סטטוס מסוים */
export function isApiError(err: unknown, status?: number): err is ApiError {
  return err instanceof ApiError && (status === undefined || err.status === status);
}

/** הודעה ידידותית מכל שגיאה */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    const m = (err as { message: string }).message;
    return /[֐-׿]/.test(m) ? m : GENERIC_MESSAGE;
  }
  return GENERIC_MESSAGE;
}
