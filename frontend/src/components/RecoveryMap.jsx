import { Suspense, lazy, useMemo, useState } from 'react';
import { buildFreshness } from '../lib/freshness.js';

// three.js ist ~150 KB gzipped — erst laden, wenn die Karte aufgeklappt wird.
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

const LEGEND = [
  { label: '< 24 h', color: '#f4506a' },
  { label: '24–48 h', color: '#f0955f' },
  { label: '48–72 h', color: '#edd3b2' },
  { label: 'Erholt', color: '#e8e2f2' },
];

// Frische-Karte: färbt das 3D-Modell nach Stunden seit letztem Training.
// Eingeklappt per Default — three.js lädt erst beim Öffnen.
export default function RecoveryMap({ plan, sessions }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('front');
  const heat = useMemo(() => buildFreshness(plan, sessions), [plan, sessions]);
  const allFresh = Object.keys(heat).length === 0;

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0 }}>Erholung</h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {open ? 'Einklappen' : 'Anzeigen'}
        </button>
      </div>

      {!open && (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          {allFresh ? 'Alles erholt — freie Bahn.' : 'Welche Muskeln noch regenerieren.'}
        </p>
      )}

      {open && (
        <>
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
                <div style={{ height: 320, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Modell wird geladen…
                </div>
              }
            >
              <MuscleBody3D heat={heat} view={view} height={320} />
            </Suspense>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }}>
            {LEGEND.map((entry) => (
              <span
                key={entry.label}
                style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: 'var(--muted)' }}
              >
                <span style={legendDotStyle(entry.color)} />
                {entry.label}
              </span>
            ))}
          </div>
          {allFresh && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              Alles erholt — kein Training in den letzten 72 Stunden.
            </p>
          )}
        </>
      )}
    </div>
  );
}
