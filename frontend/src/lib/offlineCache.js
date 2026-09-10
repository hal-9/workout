// Letzte erfolgreiche Antworten für den Kaltstart ohne Netz: /me und Plan
// hängen sonst am Netz, und der Query-Cache lebt nur im Speicher. Nur Daten,
// die die App zum Anzeigen braucht — Mutationen gehen weiter über die Queue.
const PREFIX = 'lilief-cache:';
export const CACHE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

export function cacheSet(key, data, now = Date.now()) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ saved_at: now, data }));
  } catch {
    /* voller Speicher: der Cache ist Komfort, kein Muss */
  }
}

export function cacheGet(key, now = Date.now()) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.saved_at || now - parsed.saved_at > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

// Beim Abmelden und bei 401: fremde Daten dürfen nicht stehen bleiben.
export function cacheClear() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    /* siehe cacheSet */
  }
}

// Netzfehler (fetch wirft) vs. Antwort des Servers: nur beim ersten darf der
// Cache einspringen — ein 401 heißt „nicht mehr eingeloggt".
export function isOfflineError(error) {
  return Boolean(error) && error.status == null;
}
