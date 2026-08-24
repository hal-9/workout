import { useMemo, useState } from 'react';
import { formatDuration } from 'shared/duration';
import { libraryEntries, libraryGroups, searchLibrary } from '../../lib/exerciseLibrary.js';

const chipStyle = (active) => ({
  flex: '0 0 auto',
  background: active ? 'var(--primary-dim)' : 'var(--surface2)',
  border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
  color: active ? 'var(--primary)' : 'var(--muted)',
  borderRadius: 999,
  padding: '6px 11px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
});

function prescription(entry) {
  if (entry.type === 'time' || entry.type === 'cardio') {
    return `${entry.sets} × ${formatDuration(entry.target_seconds)}`;
  }
  const weight = entry.default_weight_kg ? ` @ ${entry.default_weight_kg} kg` : '';
  return `${entry.sets} × ${entry.target_reps}${weight}`;
}

export default function ExerciseLibraryPicker({ onPick, onClose, usedNames = new Set() }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(null);

  const entries = useMemo(() => libraryEntries(), []);
  const groups = useMemo(() => libraryGroups(), []);
  const results = useMemo(() => searchLibrary(query, group, entries), [query, group, entries]);

  return (
    <div
      style={{
        border: '1px solid var(--primary)',
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 14 }}>Bibliothek</strong>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--muted)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Schließen
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Übung suchen…"
        style={{
          width: '100%',
          background: 'var(--surface2)',
          border: '1px solid var(--line)',
          color: 'var(--text)',
          borderRadius: 9,
          padding: '9px 11px',
          fontSize: 15,
          marginTop: 8,
        }}
      />

      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '8px 0' }}>
        <button type="button" onClick={() => setGroup(null)} style={chipStyle(group === null)}>
          Alle
        </button>
        {groups.map((key) => (
          <button key={key} type="button" onClick={() => setGroup(key)} style={chipStyle(group === key)}>
            {key}
          </button>
        ))}
      </div>

      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {results.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0' }}>Nichts gefunden.</p>
        )}
        {results.map((entry) => {
          const alreadyUsed = usedNames.has(entry.name.toLowerCase());
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'var(--surface2)',
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: '9px 11px',
                marginBottom: 6,
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{entry.name}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--muted)',
                    flexShrink: 0,
                  }}
                >
                  {prescription(entry)}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                {entry.muscle}
                {entry.phase === 'cooldown' && ' · Cooldown'}
                {alreadyUsed && ' · schon im Tag'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
