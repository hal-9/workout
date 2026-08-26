import { useEffect, useState } from 'react';
import Dialog from './ui/Dialog.jsx';
import Button from './ui/Button.jsx';
import {
  PUSH_CATEGORY_OPTIONS,
  currentSubscription,
  disablePush,
  enablePush,
  isIos,
  isStandalone,
  pushSupported,
  storedCategories,
  updateCategories,
} from '../lib/push.js';

const DEFAULT_CATEGORIES = PUSH_CATEGORY_OPTIONS.map((o) => o.id);

// Mitteilungs-Einstellungen: ein Master-Schalter + Kategorien pro Gerät.
export default function PushSettingsDialog({ open, onClose }) {
  const [enabled, setEnabled] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const supported = pushSupported();
  const needsInstall = !supported && isIos() && !isStandalone();

  useEffect(() => {
    if (!open || !supported) return;
    let cancelled = false;
    currentSubscription().then((sub) => {
      if (cancelled) return;
      setEnabled(Boolean(sub));
      const stored = storedCategories();
      if (stored) setCategories(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [open, supported]);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        await enablePush(categories);
        setEnabled(true);
      }
    } catch (err) {
      setError(
        err?.message === 'permission denied'
          ? 'Mitteilungen wurden im System abgelehnt. In den Einstellungen erlauben und erneut versuchen.'
          : 'Aktivieren fehlgeschlagen — ist Push auf dem Server konfiguriert?'
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(id) {
    const next = categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id];
    setCategories(next);
    if (!enabled) return;
    try {
      await updateCategories(next);
    } catch {
      setError('Speichern fehlgeschlagen.');
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Mitteilungen">
      {!supported && needsInstall && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
          Push funktioniert auf dem iPhone nur in der installierten App: Teilen-Menü → „Zum
          Home-Bildschirm" — dann hier wieder vorbeischauen.
        </p>
      )}
      {!supported && !needsInstall && (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
          Dieser Browser unterstützt keine Push-Mitteilungen.
        </p>
      )}

      {supported && (
        <>
          <button
            type="button"
            onClick={handleToggle}
            disabled={busy}
            aria-pressed={enabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              width: '100%',
              padding: '10px 12px',
              background: 'var(--surface2)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              color: 'var(--text)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              marginBottom: 12,
            }}
          >
            <span>{busy ? 'Einen Moment…' : 'Push-Mitteilungen'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: enabled ? 'var(--success)' : 'var(--muted)' }}>
              {enabled ? 'An' : 'Aus'}
            </span>
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: enabled ? 1 : 0.55 }}>
            {PUSH_CATEGORY_OPTIONS.map((option) => {
              const active = categories.includes(option.id);
              return (
                <label
                  key={option.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 4px', cursor: 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleCategory(option.id)}
                    style={{ marginTop: 3 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontSize: 14 }}>{option.label}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 12, margin: '10px 0 0' }}>{error}</p>}
        </>
      )}

      <Button variant="secondary" fullWidth onClick={onClose} style={{ marginTop: 14 }}>
        Fertig
      </Button>
    </Dialog>
  );
}
