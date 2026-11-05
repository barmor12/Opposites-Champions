import type {
  Category,
  Difficulty,
  GameResults,
  GameSettings,
  GameSummary,
  TeacherProfile,
  TeacherRoomLive,
  WordPairContent,
} from '@oc/shared';
import { apiClient } from '@/services/api';

/**
 * שכבת גישה ל־API של המורה. כל הנתיבים לפי docs/API.md.
 * apiClient מוסיף בעצמו את ה־base path (/api), לכן הנתיבים כאן יחסיים אליו.
 */

export interface StatsOverview {
  activeRooms: number;
  totalSessions: number;
  totalParticipants: number;
  averageAccuracy: number;
}

export interface WordPairListQuery {
  category?: Category | '';
  difficulty?: Difficulty | '';
  search?: string;
  page?: number;
  limit?: number;
}

export interface WordPairListResponse {
  items: WordPairContent[];
  total: number;
}

export type WordPairInput = Omit<WordPairContent, 'id'> & { slug?: string };

export interface CategoryInfo {
  id: Category;
  label: string;
  count: number;
}

export interface MediaItem {
  key: string;
  kind: string;
  url: string;
  alt: string;
}

export type ExportFormat = 'csv' | 'xlsx';

const BASE = '';

function qs(params: Record<string, string | number | boolean | undefined | ''>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

function roomPath(roomId: string, suffix = ''): string {
  return `${BASE}/games/${encodeURIComponent(roomId)}${suffix}`;
}

// ===== Auth =====
export function login(email: string, password: string): Promise<TeacherProfile> {
  return apiClient.post<TeacherProfile>(`${BASE}/auth/login`, { email, password });
}

export function logout(): Promise<{ ok: true }> {
  return apiClient.post<{ ok: true }>(`${BASE}/auth/logout`);
}

export function me(): Promise<TeacherProfile> {
  return apiClient.get<TeacherProfile>(`${BASE}/auth/me`);
}

// ===== Games =====
export function createGame(settings: GameSettings): Promise<GameSummary> {
  return apiClient.post<GameSummary>(`${BASE}/games`, settings);
}

export function listGames(): Promise<GameSummary[]> {
  return apiClient.get<GameSummary[]>(`${BASE}/games`);
}

export function getGame(roomId: string): Promise<TeacherRoomLive> {
  return apiClient.get<TeacherRoomLive>(roomPath(roomId));
}

export function startGame(roomId: string): Promise<TeacherRoomLive> {
  return apiClient.post<TeacherRoomLive>(roomPath(roomId, '/start'));
}

export function pauseGame(roomId: string): Promise<TeacherRoomLive> {
  return apiClient.post<TeacherRoomLive>(roomPath(roomId, '/pause'));
}

export function resumeGame(roomId: string): Promise<TeacherRoomLive> {
  return apiClient.post<TeacherRoomLive>(roomPath(roomId, '/resume'));
}

export function finishGame(roomId: string): Promise<TeacherRoomLive> {
  return apiClient.post<TeacherRoomLive>(roomPath(roomId, '/finish'));
}

export function nextQuestion(roomId: string): Promise<TeacherRoomLive> {
  return apiClient.post<TeacherRoomLive>(roomPath(roomId, '/next'));
}

export function setJoinOpen(roomId: string, open: boolean): Promise<TeacherRoomLive> {
  return apiClient.post<TeacherRoomLive>(roomPath(roomId, '/join-open'), { open });
}

export function newRound(roomId: string): Promise<GameSummary> {
  return apiClient.post<GameSummary>(roomPath(roomId, '/new-round'));
}

export function cancelGame(roomId: string): Promise<TeacherRoomLive> {
  return apiClient.post<TeacherRoomLive>(roomPath(roomId, '/cancel'));
}

export function removeParticipant(roomId: string, participantId: string): Promise<TeacherRoomLive> {
  return apiClient.delete<TeacherRoomLive>(
    roomPath(roomId, `/participants/${encodeURIComponent(participantId)}`),
  );
}

export function getResults(roomId: string, sessionId?: string): Promise<GameResults> {
  return apiClient.get<GameResults>(roomPath(roomId, `/results${qs({ sessionId })}`));
}

export function deleteGame(roomId: string): Promise<{ ok: true }> {
  return apiClient.delete<{ ok: true }>(roomPath(roomId));
}

export function getStatsOverview(): Promise<StatsOverview> {
  return apiClient.get<StatsOverview>(`${BASE}/games/stats/overview`);
}

/** מוריד קובץ ייצוא (CSV / Excel) ומפעיל הורדה בדפדפן. */
export async function exportResults(
  roomId: string,
  format: ExportFormat,
  sessionId?: string,
): Promise<void> {
  const url = apiClient.url(roomPath(roomId, '/export'), { format, sessionId });
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });
  if (!res.ok) {
    let message = 'הייצוא נכשל, נסו שוב';
    try {
      const body = (await res.json()) as { message?: string };
      if (typeof body.message === 'string') message = body.message;
    } catch {
      /* גוף לא JSON */
    }
    throw Object.assign(new Error(message), { status: res.status });
  }
  const blob = await res.blob();
  const filename = parseFilename(res.headers.get('content-disposition')) ?? `results-${roomId}.${format}`;
  triggerDownload(blob, filename);
}

function parseFilename(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return utf8[1];
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] ?? null;
}

function triggerDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// ===== Content =====
export function listWordPairs(query: WordPairListQuery = {}): Promise<WordPairListResponse> {
  return apiClient.get<WordPairListResponse>(`${BASE}/word-pairs${qs(query)}`);
}

export function createWordPair(input: WordPairInput): Promise<WordPairContent> {
  return apiClient.post<WordPairContent>(`${BASE}/word-pairs`, input);
}

export function updateWordPair(id: string, patch: Partial<WordPairInput>): Promise<WordPairContent> {
  return apiClient.patch<WordPairContent>(`${BASE}/word-pairs/${encodeURIComponent(id)}`, patch);
}

export function deleteWordPair(id: string): Promise<{ ok: true }> {
  return apiClient.delete<{ ok: true }>(`${BASE}/word-pairs/${encodeURIComponent(id)}`);
}

export function listCategories(): Promise<CategoryInfo[]> {
  return apiClient.get<CategoryInfo[]>(`${BASE}/categories`);
}

export function listMedia(): Promise<MediaItem[]> {
  return apiClient.get<MediaItem[]>(`${BASE}/media`);
}

/** אובייקט מרוכז – נוח ל־mock בבדיקות. */
export const teacherApi = {
  auth: { login, logout, me },
  games: {
    create: createGame,
    list: listGames,
    get: getGame,
    start: startGame,
    pause: pauseGame,
    resume: resumeGame,
    finish: finishGame,
    next: nextQuestion,
    setJoinOpen,
    newRound,
    cancel: cancelGame,
    removeParticipant,
    results: getResults,
    export: exportResults,
    remove: deleteGame,
    statsOverview: getStatsOverview,
  },
  wordPairs: {
    list: listWordPairs,
    create: createWordPair,
    update: updateWordPair,
    remove: deleteWordPair,
  },
  categories: { list: listCategories },
  media: { list: listMedia },
};

export default teacherApi;
