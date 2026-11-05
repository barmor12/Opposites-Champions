/**
 * מיירט קריאות `fetch` ל־`/api/*` ומנתב אותן למנוע הדמו. כל שאר הבקשות עוברות ל־fetch המקורי.
 */
import { SESSION_TOKEN_HEADER } from '@oc/shared';
import { API_BASE } from '@/services/api';
import { demoEngine, DemoError } from './engine';

type Json = Record<string, unknown> | unknown[] | null;

function json(status: number, body: Json): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function error(status: number, message: string, code?: string): Response {
  return json(status, { statusCode: status, message, error: code ?? 'Error' });
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const h = init?.headers;
  if (!h) return undefined;
  if (h instanceof Headers) return h.get(name) ?? undefined;
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name)?.[1];
  const found = Object.entries(h).find(([k]) => k.toLowerCase() === name);
  return found?.[1];
}

async function route(method: string, path: string, init: RequestInit | undefined): Promise<Response> {
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
  const token = headerOf(init, SESSION_TOKEN_HEADER);
  const requireToken = () => {
    if (!demoEngine.isValidToken(token)) throw new DemoError(401, 'המשחק הזה כבר לא פעיל. הצטרפו שוב', 'NO_SESSION');
  };

  if (method === 'GET' && path === '/health') return json(200, { status: 'ok', db: 'demo', uptime: Math.round(performance.now() / 1000) });
  if (method === 'POST' && path === '/rooms/join') return json(201, demoEngine.join(body) as unknown as Record<string, unknown>);
  if (method === 'GET' && /^\/rooms\/\d{6}$/.test(path)) {
    const code = path.slice('/rooms/'.length);
    if (!demoEngine.presetByCode(code)) return error(404, 'לא מצאנו חדר עם הקוד הזה');
    return json(200, demoEngine.roomView() as unknown as Record<string, unknown>);
  }
  if (method === 'GET' && path === '/player/session') {
    requireToken();
    return json(200, demoEngine.session() as unknown as Record<string, unknown>);
  }
  if (method === 'GET' && path === '/player/progress') {
    requireToken();
    return json(200, demoEngine.progress());
  }
  if (path.startsWith('/auth') || path.startsWith('/games') || path.startsWith('/word-pairs') || path.startsWith('/categories') || path.startsWith('/media')) {
    return error(503, 'ממשק המורה אינו זמין בגרסת הדמו – הוא דורש שרת אמיתי', 'DEMO_ONLY');
  }
  return error(404, 'לא מצאנו את מה שחיפשתם');
}

export function installMockFetch(): void {
  const realFetch = window.fetch.bind(window);
  const base = API_BASE || '/api';
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = raw.startsWith('http') ? new URL(raw).pathname + new URL(raw).search : raw;
    if (!url.startsWith(`${base}/`) && url !== base) return realFetch(input, init);
    const path = url.slice(base.length).split('?')[0] ?? '';
    const method = (init?.method ?? (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();
    await new Promise((r) => window.setTimeout(r, 80 + Math.random() * 120));
    try {
      return await route(method, path, init);
    } catch (err) {
      if (err instanceof DemoError) return error(err.status, err.message, err.code);
      console.error('demo api error', err);
      return error(500, 'אופס! משהו השתבש בדמו');
    }
  };
}
