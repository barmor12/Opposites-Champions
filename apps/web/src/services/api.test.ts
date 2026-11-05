import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, ApiError, errorMessage, DEFAULT_MESSAGES } from './api';
import { setPlayerToken } from '@/lib/storage';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('apiClient', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    setPlayerToken(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends JSON with credentials and X-Requested-With header', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const res = await apiClient.post<{ ok: boolean }>('/rooms/join', { code: '123456' });
    expect(res).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/rooms/join');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('include');
    const headers = init?.headers as Record<string, string>;
    expect(headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['x-player-token']).toBeUndefined();
    expect(init?.body).toBe(JSON.stringify({ code: '123456' }));
  });

  it('attaches x-player-token when a player token is stored', async () => {
    setPlayerToken('tok-123');
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { participantId: 'p1' }));
    await apiClient.get('/player/session');
    const headers = fetchMock.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers['x-player-token']).toBe('tok-123');
  });

  it('maps NestJS error body to ApiError with Hebrew message', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { statusCode: 404, message: 'הַחֶדֶר לֹא נִמְצָא', error: 'Not Found' }));
    await expect(apiClient.get('/rooms/000000')).rejects.toMatchObject({ status: 404, message: 'הַחֶדֶר לֹא נִמְצָא' });
  });

  it('joins validation message arrays', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(400, { statusCode: 400, message: ['הַשֵּׁם קָצָר מִדַּי', 'קוֹד לֹא תַּקִּין'] }));
    const err = await apiClient.post('/rooms/join', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe('הַשֵּׁם קָצָר מִדַּי, קוֹד לֹא תַּקִּין');
  });

  it('falls back to a Hebrew default message when body has none', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } }));
    const err = (await apiClient.get('/health').catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.message).toBe(DEFAULT_MESSAGES[502]);
    expect(/[֐-׿]/.test(err.message)).toBe(true);
  });

  it('maps network failures to status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const err = (await apiClient.get('/health').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
    expect(err.isNetwork).toBe(true);
    expect(err.message).toBe(DEFAULT_MESSAGES[0]);
  });

  it('returns undefined for 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiClient.delete('/games/1')).resolves.toBeUndefined();
  });

  it('appends query params', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));
    await apiClient.get('/word-pairs', { query: { category: 'SIZES', page: 2, search: '' } });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/word-pairs?category=SIZES&page=2');
  });

  it('errorMessage returns Hebrew text for unknown errors', () => {
    expect(errorMessage(new Error('boom'))).toMatch(/[֐-׿]/);
    expect(errorMessage(new ApiError(403, 'אֵין הַרְשָׁאָה'))).toBe('אֵין הַרְשָׁאָה');
  });
});
