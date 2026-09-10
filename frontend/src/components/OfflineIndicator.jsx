import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getQueuedSets, replayQueue } from '../offlineQueue.js';

async function postSet(sessionId, payload) {
  return api.post(`/sessions/${sessionId}/sets`, payload);
}

async function deleteSet(sessionId, payload) {
  return api.delete(`/sessions/${sessionId}/sets`, payload);
}

async function postFinish(sessionId, payload) {
  return api.post(`/sessions/${sessionId}/finish`, payload);
}

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  // „Synchronisiert" kurz zeigen, damit der Wechsel sichtbar ist und nicht
  // nur das Verschwinden der Leiste.
  const [justSynced, setJustSynced] = useState(false);

  async function refreshPending() {
    const entries = await getQueuedSets();
    setPending(entries.length);
    return entries.length;
  }

  async function sync() {
    const before = await refreshPending();
    await replayQueue({ postSet, deleteSet, postFinish });
    const after = await refreshPending();
    if (before > 0 && after === 0) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2500);
    }
  }

  useEffect(() => {
    sync();

    function handleOnline() {
      setIsOnline(true);
      sync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pending === 0 && !justSynced) return null;

  const label = !isOnline
    ? pending > 0
      ? `Offline · ${pending} Sätze auf diesem Gerät gespeichert`
      : 'Offline · Sätze werden auf diesem Gerät gespeichert'
    : pending > 0
      ? `Sync läuft… · ${pending} Sätze`
      : 'Synchronisiert';

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(60px + env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        background: 'var(--surface2)',
        border: '1px solid var(--line)',
        color: isOnline ? 'var(--success)' : 'var(--muted)',
        borderRadius: 10,
        padding: '6px 12px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
      }}
    >
      {label}
    </div>
  );
}
