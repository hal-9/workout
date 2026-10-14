import { describe, it, expect } from 'vitest';
import { mergeQueuedSets, replayWith } from './offlineQueue.js';

// Speicher im Arbeitsspeicher mit derselben Schnittstelle wie IndexedDB.
function memoryStore(entries) {
  const map = new Map(entries.map((e) => [e.key, { ...e }]));
  return {
    map,
    getAll: async () => [...map.values()].sort((a, b) => (a.key < b.key ? -1 : 1)),
    removeIfUnchanged: async (key, rev) => {
      if (map.get(key)?.rev === rev) map.delete(key);
    },
    markFailed: async (key, rev, status) => {
      if (map.get(key)?.rev === rev) map.set(key, { ...map.get(key), failed: status });
    },
  };
}

const set = (key, reps, extra = {}) => ({
  key,
  rev: `r-${key}-${reps}`,
  userId: 1,
  sessionId: 7,
  operation: 'upsert',
  payload: { exercise_id: 'row', set_number: Number(key.split(':')[2]), reps },
  ...extra,
});
const httpError = (status) => Object.assign(new Error('x'), { status });

describe('replayWith', () => {
  it('Abschluss kommt nach allen Sätzen, auch wenn der Schlüssel früher sortiert', async () => {
    const calls = [];
    const store = memoryStore([
      { key: '!finish', rev: 'f', userId: 1, sessionId: 7, operation: 'finish', payload: {} },
      set('7:row:1', 10),
    ]);
    await replayWith(
      store,
      {
        postSet: async () => calls.push('set'),
        postFinish: async () => calls.push('finish'),
      },
      1
    );
    expect(calls).toEqual(['set', 'finish']);
    expect(store.map.size).toBe(0);
  });

  it('neuere Änderung während des Requests bleibt erhalten (8 gesendet, 10 eingetippt)', async () => {
    const store = memoryStore([set('7:row:1', 8)]);
    const sent = [];
    const handlers = {
      postSet: async (_sid, payload) => {
        sent.push(payload.reps);
        if (payload.reps === 8) store.map.set('7:row:1', set('7:row:1', 10));
      },
    };
    await replayWith(store, handlers, 1);
    expect(store.map.get('7:row:1').payload.reps).toBe(10);
    await replayWith(store, handlers, 1);
    expect(sent).toEqual([8, 10]);
    expect(store.map.size).toBe(0);
  });

  it('abgelehnter Satz (409) bleibt als fehlgeschlagen sichtbar und blockiert den Rest nicht', async () => {
    const store = memoryStore([set('7:row:1', 8), set('7:row:2', 9)]);
    const ok = [];
    await replayWith(
      store,
      {
        postSet: async (_sid, p) => {
          if (p.set_number === 1) throw httpError(409);
          ok.push(p.set_number);
        },
      },
      1
    );
    expect(store.map.get('7:row:1').failed).toBe(409);
    expect(ok).toEqual([2]);
    expect(store.map.has('7:row:2')).toBe(false);
  });

  it('ohne Netz: abbrechen, nichts löschen, nichts als fehlgeschlagen markieren', async () => {
    const store = memoryStore([set('7:row:1', 8), set('7:row:2', 9)]);
    await replayWith(store, { postSet: async () => { throw new Error('offline'); } }, 1);
    expect([...store.map.values()].every((e) => !e.failed)).toBe(true);
    expect(store.map.size).toBe(2);
  });

  it('spielt keine Einträge eines anderen Accounts ab', async () => {
    const store = memoryStore([set('7:row:1', 8, { userId: 2 })]);
    const sent = [];
    await replayWith(store, { postSet: async (_s, p) => sent.push(p) }, 1);
    expect(sent).toEqual([]);
    expect(store.map.size).toBe(1);
  });

  it('Abschluss mit 409 (schon beendet) gilt als erledigt', async () => {
    const store = memoryStore([{ key: 'finish:7', rev: 'f', userId: 1, sessionId: 7, operation: 'finish', payload: {} }]);
    await replayWith(store, { postFinish: async () => { throw httpError(409); } }, 1);
    expect(store.map.size).toBe(0);
  });

  it('abgemeldet (401): später erneut, nicht als abgelehnt markieren', async () => {
    const store = memoryStore([set('7:row:1', 8)]);
    await replayWith(store, { postSet: async () => { throw httpError(401); } }, 1);
    expect(store.map.get('7:row:1').failed).toBeUndefined();
  });
});

describe('mergeQueuedSets', () => {
  const log = (set_number, reps) => ({ exercise_id: 'row', set_number, reps, weight_kg: 10 });
  const entry = (operation, set_number, reps, extra = {}) => ({
    sessionId: 7,
    operation,
    payload: { exercise_id: 'row', set_number, ...(reps != null && { reps, weight_kg: 10 }) },
    ...extra,
  });

  it('offline geloggte Sätze kommen beim Kaltstart dazu, Änderungen ersetzen, Löschungen entfernen', () => {
    const merged = mergeQueuedSets(
      [log(1, 10), log(2, 9)],
      [entry('upsert', 2, 11), entry('upsert', 3, 8), entry('delete', 1)],
      7
    );
    expect(merged.map((l) => [l.set_number, l.reps])).toEqual([[2, 11], [3, 8]]);
  });

  it('ignoriert andere Sessions, abgelehnte Einträge und den Abschluss', () => {
    const merged = mergeQueuedSets(
      [log(1, 10)],
      [entry('upsert', 2, 8, { sessionId: 8 }), entry('upsert', 3, 8, { failed: 409 }), { sessionId: 7, operation: 'finish', payload: {} }],
      7
    );
    expect(merged).toEqual([log(1, 10)]);
  });
});
