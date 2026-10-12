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

  // Offline: Wolke durchgestrichen · Sync: Pfeile im Kreis · fertig: Haken
  const iconPath = !isOnline
    ? 'M3 3l18 18M7.5 18h9.2a3.8 3.8 0 0 0 1.6-7.2M15.5 6.6A5.5 5.5 0 0 0 7 9.1 4.5 4.5 0 0 0 7.5 18'
    : pending > 0
      ? 'M20 12a8 8 0 0 1-14.2 5M4 12a8 8 0 0 1 14.2-5M18.5 3v4h-4M5.5 21v-4h4'
      : 'M5 12.5l4.5 4.5L19 7.5';

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 'calc(64px + env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg)',
        boxShadow: 'var(--shadow-raised-sm), inset 1px 1px 0 var(--neu-rim)',
        color: isOnline && pending === 0 ? 'var(--success)' : 'var(--text)',
        borderRadius: 999,
        padding: '8px 16px 8px 12px',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: isOnline ? undefined : 'var(--muted)' }}>
        <path d={iconPath} />
      </svg>
      {label}
    </div>
  );
}
