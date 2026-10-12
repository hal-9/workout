import { Suspense, lazy, useMemo, useState } from 'react';
import { buildFreshness } from '../lib/freshness.js';
import Card from './ui/Card.jsx';
import Icon from './ui/Icon.jsx';

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
  boxShadow: 'inset 0 0 0 1px var(--line)', // „Erholt" ist fast so hell wie der Grund
});

// Aufklapp-Knopf (auch im Trainingsbaum): kleine erhabene Pille mit Chevron.
export function ToggleButton({ open, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className="btn btn-secondary"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        minHeight: 44,
        padding: '0 12px 0 14px',
        border: 'none',
        borderRadius: 999,
        background: 'var(--bg)',
        color: 'var(--text)',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {open ? 'Einklappen' : 'Anzeigen'}
      <Icon
        name="chevronDown"
        size={16}
        style={{ color: 'var(--muted)', transform: open ? 'rotate(180deg)' : 'none' }}
      />
    </button>
  );
}

// Farben spiegeln die Material-Töne in MuscleBody3D (FRESHNESS_LEVELS) — 3D-Asset ohne Tokens.
const LEGEND = [
  { label: '< 24 h', color: '#f4506a' },
  { label: '24–48 h', color: '#f0955f' },
  { label: '48–72 h', color: '#edd3b2' },
  { label: 'Erholt', color: '#e8e2f2' },
];

// Trainingslast-Karte: färbt das 3D-Modell nach Stunden seit dem letzten
// geloggten Satz, der die Region belastet hat. Eingeklappt per Default —
// three.js lädt erst beim Öffnen.
export default function RecoveryMap({ sessions }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('front');
  const heat = useMemo(() => buildFreshness(sessions), [sessions]);
  const allFresh = Object.keys(heat).length === 0;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Erholung</h3>
        <ToggleButton open={open} onClick={() => setOpen((o) => !o)} />
      </div>

      {!open && (
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>
          {allFresh
            ? 'Alles erholt — freie Bahn.'
            : 'Geschätzt aus deinen geloggten Sätzen der letzten 72 Stunden.'}
        </p>
      )}

      {open && (
        <>
          <div className="px-seg" style={{ display: 'flex', margin: '12px 0' }}>
            <button
              type="button"
              className="px-seg-opt"
              aria-pressed={view === 'front'}
              onClick={() => setView('front')}
              style={{ flex: 1 }}
            >
              Vorderseite
            </button>
            <button
              type="button"
              className="px-seg-opt"
              aria-pressed={view === 'back'}
              onClick={() => setView('back')}
              style={{ flex: 1 }}
            >
              Rückseite
            </button>
          </div>

          <div
            style={{
              borderRadius: 16,
              overflow: 'hidden',
              background: 'var(--bg)',
              boxShadow: 'var(--shadow-inset)',
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 12 }}>
            {LEGEND.map((entry) => (
              <span
                key={entry.label}
                style={{ display: 'inline-flex', alignItems: 'center', fontSize: 13, color: 'var(--muted)' }}
              >
                <span style={legendDotStyle(entry.color)} />
                {entry.label}
              </span>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            {allFresh
              ? 'Alles erholt — kein geloggter Satz in den letzten 72 Stunden.'
              : 'Zeit seit dem letzten geloggten Satz pro Region — eine Schätzung, kein Messwert.'}
          </p>
        </>
      )}
    </Card>
  );
}
