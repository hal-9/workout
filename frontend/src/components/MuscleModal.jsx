import { Suspense, lazy, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ZONE_HINTS, ZONE_LABELS, exerciseZones } from 'shared/muscles';
import { useScrollLock } from '../lib/scrollLock.js';
import { CloseButton } from './ui/Dialog.jsx';

// three.js ist ~150 KB gzipped — erst laden, wenn das Modell wirklich geöffnet wird.
const MuscleBody3D = lazy(() => import('./MuscleBody3D.jsx'));

const legendDotStyle = (color) => ({
  display: 'inline-block',
  width: 10,
  height: 10,
  borderRadius: 999,
  background: color,
  flexShrink: 0,
  transform: 'translateY(1px)',
});

// Segment: Mulde als Schiene, gewählte Seite erhaben.
const viewBtnStyle = (active) => ({
  flex: 1,
  minHeight: 44,
  border: 'none',
  borderRadius: 999,
  background: 'var(--bg)',
  boxShadow: active ? 'var(--shadow-raised-sm), inset 1px 1px 0 var(--neu-rim)' : 'none',
  color: active ? 'var(--text)' : 'var(--muted)',
  fontSize: 14,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
});

function Legend({ label, color, zones }) {
  if (!zones.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 14, padding: '10px 0' }}>
      <span style={legendDotStyle(color)} />
      <span>
        <span style={{ color: 'var(--muted)' }}>{label}: </span>
        {zones.map((key) => ZONE_LABELS[key] ?? key).join(', ')}
      </span>
    </div>
  );
}

export default function MuscleModal({ exercise, onClose }) {
  // Rückseitige Zonen zeigen von vorne nichts — dann direkt von hinten starten.
  const zones = exerciseZones(exercise ?? {});
  const backHeavy = zones.primary.length > 0
    && zones.primary.every((key) => [
      'ruecken', 'ruecken_lat', 'ruecken_oben', 'unterer_ruecken',
      'gesaess', 'gesaess_gross', 'gesaess_seite', 'hamstrings',
      'waden', 'waden_gastro', 'waden_soleus', 'trizeps', 'schultern_hinten',
    ].includes(key));
  // Teilzonen erklären, warum z. B. Seitheben ≠ Schulterdrücken ist.
  const hints = [...zones.primary, ...zones.secondary].filter((key) => ZONE_HINTS[key]);
  const [view, setView] = useState(backHeavy ? 'back' : 'front');
  useScrollLock();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!exercise) return null;

  // Portal an den body: aus dem Detail-Sheet heraus geöffnet, wäre „fixed" sonst
  // relativ zum Sheet (Transform/Backdrop-Filter) und die Karte säße unten darin.
  return createPortal(
    <div
      onClick={onClose}
      className="ui-scrim"
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top) + 16px) 12px calc(env(safe-area-inset-bottom) + 16px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ui-rise"
        role="dialog"
        aria-modal="true"
        aria-label={`Muskelgruppen für ${exercise.name}`}
        style={{
          // Feste Höhe statt Sheet: das Modell bekommt den freien Platz, nichts ragt
          // unten raus, und die Seite muss nie über dem Canvas gescrollt werden.
          width: '100%',
          maxWidth: 560,
          height: 'min(760px, 100%)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: 28,
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0, paddingTop: 4 }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>{exercise.name}</h2>
            {exercise.muscle && (
              <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>{exercise.muscle}</div>
            )}
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div
          role="group"
          aria-label="Ansicht"
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            margin: '16px 0 12px',
            borderRadius: 999,
            background: 'var(--bg)',
            boxShadow: 'var(--shadow-inset-sm)',
          }}
        >
          <button type="button" className="btn" aria-pressed={view === 'front'} onClick={() => setView('front')} style={viewBtnStyle(view === 'front')}>
            Vorderseite
          </button>
          <button type="button" className="btn" aria-pressed={view === 'back'} onClick={() => setView('back')} style={viewBtnStyle(view === 'back')}>
            Rückseite
          </button>
        </div>

        {/* Modell in einer Mulde (Rolle: Wert) — nimmt die ganze Resthöhe */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 240,
            borderRadius: 24,
            overflow: 'hidden',
            background: 'var(--bg)',
            boxShadow: 'var(--shadow-inset)',
          }}
        >
          <Suspense
            fallback={
              <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 14 }}>
                Modell wird geladen…
              </div>
            }
          >
            <MuscleBody3D primary={zones.primary} secondary={zones.secondary} view={view} height="100%" />
          </Suspense>
        </div>

        <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', margin: '10px 0 8px' }}>
          Wischen zum Drehen · zwei Finger zum Zoomen
        </p>

        {/* Farben spiegeln die Materialien in MuscleBody3D (dort als Hex).
            Nur dieser Teil scrollt — Wischen auf dem Modell dreht es. */}
        <div style={{ flex: '0 1 auto', maxHeight: '32%', overflowY: 'auto', overscrollBehavior: 'contain' }}>
          <Legend label="Primär" color="#f4506a" zones={zones.primary} />
          <Legend label="Sekundär" color="#f0955f" zones={zones.secondary} />
          {!zones.primary.length && !zones.secondary.length && (
            <div style={{ fontSize: 14, color: 'var(--muted)', padding: '10px 0' }}>
              Für diese Übung sind keine Muskelgruppen hinterlegt.
            </div>
          )}
          {hints.length > 0 && (
            <div style={{ marginTop: 4, paddingTop: 10, borderTop: '1px solid var(--line)', display: 'grid', gap: 6, fontSize: 13, color: 'var(--muted)' }}>
              {hints.map((key) => (
                <div key={key}>
                  <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{ZONE_LABELS[key]}:</strong> {ZONE_HINTS[key]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
