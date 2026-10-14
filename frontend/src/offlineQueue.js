import { api } from './api.js';

const DB_NAME = 'workout-offline-queue';
const STORE_NAME = 'set-upserts';

// Einträge gehören einem Account: nach Konto-Wechsel auf demselben Gerät
// werden fremde Einträge weder gezählt noch abgespielt (bleiben aber liegen,
// bis der Account zurückkommt). Gesetzt in App, sobald /me bekannt ist.
let currentUserId = null;
export function setQueueUser(id) {
  currentUserId = id ?? null;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      let result;
      Promise.resolve(fn(tx.objectStore(STORE_NAME))).then((r) => {
        result = r;
      });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

// IndexedDB-Speicher hinter derselben kleinen Schnittstelle, die die
// Replay-Logik nutzt — Tests geben einen Speicher im Arbeitsspeicher hinein.
const idbStore = {
  getAll: () => withStore('readonly', (s) => request(s.getAll())),
  put: (entry) => withStore('readwrite', (s) => request(s.put(entry))),
  remove: (key) => withStore('readwrite', (s) => request(s.delete(key))),
  // Nur löschen, wenn der Eintrag noch der gesendete ist. Wurde er während des
  // Requests neu geschrieben (neue rev), bleibt die neuere Änderung erhalten.
  removeIfUnchanged: (key, rev) =>
    withStore('readwrite', async (s) => {
      const current = await request(s.get(key));
      if (current?.rev === rev) await request(s.delete(key));
    }),
  markFailed: (key, rev, status) =>
    withStore('readwrite', async (s) => {
      const current = await request(s.get(key));
      if (current?.rev === rev) await request(s.put({ ...current, failed: status }));
    }),
};

function keyFor(payload) {
  return `${payload.session_id}:${payload.exercise_id}:${payload.set_number}`;
}

const newRev = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function enqueue(key, sessionId, operation, payload) {
  return idbStore.put({ key, rev: newRev(), userId: currentUserId, sessionId, operation, payload });
}

export function enqueueSet(sessionId, payload) {
  return enqueue(keyFor({ session_id: sessionId, ...payload }), sessionId, 'upsert', payload);
}

export function enqueueDelete(sessionId, payload) {
  return enqueue(keyFor({ session_id: sessionId, ...payload }), sessionId, 'delete', payload);
}

export function enqueueFinish(sessionId, payload = {}) {
  return enqueue(`finish:${sessionId}`, sessionId, 'finish', payload);
}

export function cancelQueuedSet(sessionId, payload) {
  return idbStore.remove(keyFor({ session_id: sessionId, ...payload }));
}

// Alte Einträge (vor Account-Bindung) haben keine userId — die gehören
// niemand Bestimmtem und laufen weiter; der Server prüft den Besitz.
const ownedBy = (userId) => (e) => e.userId == null || e.userId === userId;

/** Offene (nicht abgelehnte) Einträge des angemeldeten Accounts. */
export async function getQueuedSets() {
  return (await idbStore.getAll()).filter((e) => ownedBy(currentUserId)(e) && !e.failed);
}

/** Vom Server abgelehnte Änderungen — sichtbar statt still gelöscht. */
export async function getFailedEntries() {
  return (await idbStore.getAll()).filter((e) => ownedBy(currentUserId)(e) && e.failed);
}

export async function discardFailedEntries() {
  for (const entry of await getFailedEntries()) await idbStore.remove(entry.key);
}

const defaultHandlers = {
  postSet: (sessionId, payload) => api.post(`/sessions/${sessionId}/sets`, payload),
  deleteSet: (sessionId, payload) => api.delete(`/sessions/${sessionId}/sets`, payload),
  postFinish: (sessionId, payload) => api.post(`/sessions/${sessionId}/finish`, payload),
};

/**
 * Spielt die Warteschlange ab. Reihenfolge: alle Satz-Änderungen vor jedem
 * Abschluss, damit „fertig" nie vor den letzten Sätzen beim Server ankommt.
 * Ohne Netz (kein HTTP-Status), abgemeldet (401) oder 5xx: abbrechen, später erneut.
 * Abgelehnt (4xx): als fehlgeschlagen markieren und mit dem Rest weitermachen.
 * Ein 409 auf einen Abschluss heißt „schon beendet/verworfen" — erledigt.
 */
export async function replayWith(store, handlers, userId) {
  const entries = (await store.getAll())
    .filter((e) => ownedBy(userId)(e) && !e.failed)
    .sort((a, b) => (a.operation === 'finish') - (b.operation === 'finish'));
  for (const entry of entries) {
    try {
      if (entry.operation === 'finish') await handlers.postFinish(entry.sessionId, entry.payload);
      else if (entry.operation === 'delete') await handlers.deleteSet(entry.sessionId, entry.payload);
      else await handlers.postSet(entry.sessionId, entry.payload);
      await store.removeIfUnchanged(entry.key, entry.rev);
    } catch (err) {
      if (!err.status || err.status >= 500 || err.status === 401) break;
      if (entry.operation === 'finish' && err.status === 409) await store.removeIfUnchanged(entry.key, entry.rev);
      else await store.markFailed(entry.key, entry.rev, err.status);
    }
  }
}

// Ein Sync zur Zeit pro Tab: online-Event, Indikator und Abschluss können
// gleichzeitig anstoßen — sie reihen sich hintereinander.
let chain = Promise.resolve();
export function syncQueue(handlers = defaultHandlers) {
  chain = chain.then(() => replayWith(idbStore, handlers, currentUserId)).catch(() => {});
  return chain;
}
