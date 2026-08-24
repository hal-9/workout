import { Suspense, lazy, useEffect, useState } from 'react';
import { ZONE_LABELS, exerciseZones } from 'shared/muscles';

// three.js ist ~150 KB gzipped — erst laden, wenn das Modell wirklich geöffnet wird.
const MuscleBody3D = lazy(() => import('./MuscleBody3D.jsx'));

const legendDotStyle = (color) => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: 999,
  background: color,
  marginRight: 6,
  flexShrink: 0,
});

const viewBtnStyle = (active) => ({
  flex: 1,
  background: active ? 'var(--primary-dim)' : 'var(--surface2)',
  border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
  color: active ? 'var(--primary)' : 'var(--muted)',
  borderRadius: 10,
  padding: '8px 0',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  cursor: 'pointer',
});

function Legend({ label, color, zones }) {
  if (!zones.length) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
      <span style={legendDotStyle(color)} />
      <span style={{ flexShrink: 0 }}>{label}:</span>
      <span style={{ color: 'var(--text)' }}>{zones.map((key) => ZONE_LABELS[key] ?? key).join(', ')}</span>
    </div>
  );
}

export default function MuscleModal({ exercise, onClose }) {
  // Rückseitige Zonen zeigen von vorne nichts — dann direkt von hinten starten.
  const zones = exerciseZones(exercise ?? {});
  const backHeavy = zones.primary.length > 0
    && zones.primary.every((key) => ['ruecken', 'unterer_ruecken', 'gesaess', 'hamstrings', 'waden', 'trizeps'].includes(key));
  const [view, setView] = useState(backHeavy ? 'back' : 'front');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!exercise) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(46, 36, 64, 0.42)',
        WebkitBackdropFilter: 'blur(6px)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass"
        role="dialog"
        aria-modal="true"
        aria-label={`Muskelgruppen für ${exercise.name}`}
        style={{
          width: '100%',
          maxWidth: 420,
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 20,
          padding: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>{exercise.name}</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {exercise.muscle}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--line)',
              borderRadius: 999,
              width: 32,
              height: 32,
              color: 'var(--muted)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, margin: '12px 0 8px' }}>
          <button type="button" onClick={() => setView('front')} style={viewBtnStyle(view === 'front')}>
            Vorderseite
          </button>
          <button type="button" onClick={() => setView('back')} style={viewBtnStyle(view === 'back')}>
            Rückseite
          </button>
        </div>

        <div
          style={{
            borderRadius: 14,
            overflow: 'hidden',
            background: 'var(--surface2)',
            border: '1px solid var(--line)',
          }}
        >
          <Suspense
            fallback={
              <div style={{ height: 340, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Modell wird geladen…
              </div>
            }
          >
            <MuscleBody3D primary={zones.primary} secondary={zones.secondary} view={view} height={340} />
          </Suspense>
        </div>

        <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', margin: '8px 0 12px' }}>
          Wischen zum Drehen · zwei Finger zum Zoomen
        </p>

        <div style={{ display: 'grid', gap: 6 }}>
          <Legend label="Primär" color="#f4506a" zones={zones.primary} />
          <Legend label="Sekundär" color="#f0955f" zones={zones.secondary} />
          {!zones.primary.length && !zones.secondary.length && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Für diese Übung sind keine Muskelgruppen hinterlegt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
