const DB_NAME = 'workout-offline-queue';
const STORE_NAME = 'set-upserts';

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

function keyFor(payload) {
  return `${payload.session_id}:${payload.exercise_id}:${payload.set_number}`;
}

async function putQueuedEntry(entry) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function enqueueSet(sessionId, payload) {
  const entry = {
    key: keyFor({ session_id: sessionId, ...payload }),
    sessionId,
    operation: 'upsert',
    payload,
  };
  await putQueuedEntry(entry);
}

export async function enqueueDelete(sessionId, payload) {
  const entry = {
    key: keyFor({ session_id: sessionId, ...payload }),
    sessionId,
    operation: 'delete',
    payload,
  };
  await putQueuedEntry(entry);
}

export async function cancelQueuedSet(sessionId, payload) {
  await removeQueuedSet(keyFor({ session_id: sessionId, ...payload }));
}

export async function getQueuedSets() {
  const db = await openDb();
  const entries = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return entries;
}

async function removeQueuedSet(key) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function replayQueue({ postSet, deleteSet, postFinish }) {
  const entries = await getQueuedSets();
  for (const entry of entries) {
    try {
      if (entry.operation === 'finish') {
        await postFinish(entry.sessionId, entry.payload);
      } else if (entry.operation === 'delete') {
        await deleteSet(entry.sessionId, entry.payload);
      } else {
        await postSet(entry.sessionId, entry.payload);
      }
      await removeQueuedSet(entry.key);
    } catch (err) {
      if (err.status === 409) {
        await removeQueuedSet(entry.key);
        continue;
      }
      break;
    }
  }
}

export async function enqueueFinish(sessionId, payload = {}) {
  const entry = {
    key: `finish:${sessionId}`,
    sessionId,
    operation: 'finish',
    payload,
  };
  await putQueuedEntry(entry);
}
