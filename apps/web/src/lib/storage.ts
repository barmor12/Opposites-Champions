/** גישה בטוחה ל־localStorage/sessionStorage (עלול לזרוק במצב פרטי / iframe) */
export const PLAYER_TOKEN_KEY = 'oc.player.token';

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export const storage = {
  get(key: string): string | null {
    return safe(() => window.localStorage.getItem(key), null);
  },
  set(key: string, value: string): void {
    safe(() => window.localStorage.setItem(key, value), undefined);
  },
  remove(key: string): void {
    safe(() => window.localStorage.removeItem(key), undefined);
  },
  getJSON<T>(key: string, fallback: T): T {
    const raw = storage.get(key);
    if (!raw) return fallback;
    return safe(() => JSON.parse(raw) as T, fallback);
  },
  setJSON(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value));
  },
};

export const session = {
  getJSON<T>(key: string, fallback: T): T {
    return safe(() => {
      const raw = window.sessionStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    }, fallback);
  },
  setJSON(key: string, value: unknown): void {
    safe(() => window.sessionStorage.setItem(key, JSON.stringify(value)), undefined);
  },
  remove(key: string): void {
    safe(() => window.sessionStorage.removeItem(key), undefined);
  },
};

export function getPlayerToken(): string | null {
  return storage.get(PLAYER_TOKEN_KEY);
}
export function setPlayerToken(token: string | null): void {
  if (token) storage.set(PLAYER_TOKEN_KEY, token);
  else storage.remove(PLAYER_TOKEN_KEY);
}
