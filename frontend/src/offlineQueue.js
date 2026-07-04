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

export async function enqueueSet(sessionId, payload) {
  const db = await openDb();
  const entry = { key: keyFor({ session_id: sessionId, ...payload }), sessionId, payload };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
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

export async function replayQueue(postSet) {
  const entries = await getQueuedSets();
  for (const entry of entries) {
    try {
      await postSet(entry.sessionId, entry.payload);
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
