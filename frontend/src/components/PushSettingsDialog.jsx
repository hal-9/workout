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
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)' }}>
          Push funktioniert auf dem iPhone nur in der installierten App: Teilen-Menü → „Zum
          Home-Bildschirm" — dann hier wieder vorbeischauen.
        </p>
      )}
      {!supported && !needsInstall && (
        <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--muted)' }}>
          Dieser Browser unterstützt keine Push-Mitteilungen.
        </p>
      )}

      {supported && (
        <>
          {/* Hauptschalter: erhabene Zeile, Schalter als Mulde mit Knopf */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={busy}
            aria-pressed={enabled}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              width: '100%',
              minHeight: 56,
              padding: '10px 14px 10px 18px',
              background: 'var(--bg)',
              border: 'none',
              borderRadius: 20,
              color: 'var(--text)',
              fontSize: 16,
              fontWeight: 600,
              cursor: busy ? 'default' : 'pointer',
              marginBottom: 16,
            }}
          >
            <span>{busy ? 'Einen Moment…' : 'Push-Mitteilungen'}</span>
            <span
              aria-hidden="true"
              style={{
                position: 'relative',
                width: 52,
                height: 30,
                borderRadius: 999,
                flexShrink: 0,
                background: enabled ? 'var(--primary)' : 'var(--bg)',
                boxShadow: 'var(--shadow-inset-sm)',
              }}
              className="ui-knob"
            >
              <span
                style={{
                  position: 'absolute',
                  top: 3,
                  left: enabled ? 25 : 3,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'var(--bg)',
                  boxShadow: 'var(--shadow-raised-sm)',
                }}
                className="ui-knob"
              />
            </span>
          </button>

          <div
            style={{
              borderRadius: 24,
              padding: '4px 14px',
              background: 'var(--bg)',
              boxShadow: 'var(--shadow-inset)',
              opacity: enabled ? 1 : 0.6,
            }}
          >
            {PUSH_CATEGORY_OPTIONS.map((option, i) => {
              const active = categories.includes(option.id);
              return (
                <label
                  key={option.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 0',
                    borderTop: i ? '1px solid var(--line)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleCategory(option.id)}
                    style={{ width: 20, height: 20, margin: '1px 0 0', accentColor: 'var(--primary)', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontSize: 15 }}>{option.label}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)' }}>{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {error && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
        </>
      )}

      <Button variant="secondary" fullWidth onClick={onClose} style={{ marginTop: 18 }}>
        Fertig
      </Button>
    </Dialog>
  );
}
