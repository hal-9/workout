import { useMemo, useState } from 'react';
import { formatDuration } from 'shared/duration';
import { libraryEntries, libraryGroups, searchLibrary } from '../../lib/exerciseLibrary.js';
import Icon from '../ui/Icon.jsx';

// Gewählt = erhaben in --text, sonst flach gedämpft — der Behälter ist eingelassen.
const chipStyle = (active) => ({
  flex: '0 0 auto',
  minHeight: 44,
  background: 'var(--bg)',
  border: 'none',
  boxShadow: active ? 'var(--shadow-raised-sm), inset 1px 1px 0 var(--neu-rim)' : 'none',
  color: active ? 'var(--text)' : 'var(--muted)',
  borderRadius: 999,
  padding: '8px 14px',
  fontSize: 14,
  fontWeight: active ? 600 : 500,
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
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>Bibliothek</span>
        <button
          type="button"
          onClick={onClose}
          className="btn"
          style={{
            minHeight: 44,
            background: 'none',
            border: 'none',
            color: 'var(--primary)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            padding: '0 4px',
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
          minHeight: 44,
          background: 'var(--bg)',
          border: 'none',
          boxShadow: 'var(--shadow-inset-sm)',
          color: 'var(--text)',
          borderRadius: 14,
          padding: '10px 14px',
          fontSize: 16,
          marginTop: 6,
        }}
      />

      <div
        className="neu-inset"
        style={{ display: 'flex', gap: 4, overflowX: 'auto', margin: '12px 0', padding: 4, borderRadius: 999 }}
      >
        <button type="button" onClick={() => setGroup(null)} aria-pressed={group === null} className="btn" style={chipStyle(group === null)}>
          Alle
        </button>
        {groups.map((key) => (
          <button key={key} type="button" onClick={() => setGroup(key)} aria-pressed={group === key} className="btn" style={chipStyle(group === key)}>
            {key}
          </button>
        ))}
      </div>

      <ul className="pl-tray" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {results.length === 0 && (
          <li style={{ color: 'var(--muted)', fontSize: 14, padding: '12px 6px' }}>Nichts gefunden.</li>
        )}
        {results.map((entry) => {
          const alreadyUsed = usedNames.has(entry.name.toLowerCase());
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onPick(entry)}
                className="pl-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  minHeight: 44,
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  borderRadius: 14,
                  padding: '10px 6px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, lineHeight: 1.35 }}>{entry.name}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    {prescription(entry)} · {entry.muscle}
                    {entry.phase === 'cooldown' && ' · Cooldown'}
                    {alreadyUsed && ' · schon im Tag'}
                  </span>
                </span>
                <Icon name="plus" size={18} style={{ color: 'var(--muted)' }} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
