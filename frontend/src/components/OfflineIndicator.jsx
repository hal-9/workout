import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getQueuedSets, replayQueue } from '../offlineQueue.js';

async function postSet(sessionId, payload) {
  return api.post(`/sessions/${sessionId}/sets`, payload);
}

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);

  async function refreshPending() {
    const entries = await getQueuedSets();
    setPending(entries.length);
  }

  async function sync() {
    await replayQueue(postSet);
    await refreshPending();
  }

  useEffect(() => {
    refreshPending();
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

  if (isOnline && pending === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 'calc(8px + env(safe-area-inset-top))',
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
      {!isOnline && 'Offline'}
      {isOnline && pending > 0 && 'Sync läuft…'}
      {pending > 0 && ` · ${pending} Sätze warten auf Sync`}
    </div>
  );
}
