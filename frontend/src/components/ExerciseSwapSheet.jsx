import { useMemo, useState } from 'react';
import { formatDuration } from 'shared/duration';
import { EQUIPMENT, ZONE_LABELS, exerciseZones } from 'shared/muscles';
import { equipmentLabel, rankAlternatives } from '../lib/exerciseSwap.js';
import { getSwapEquipment, setSwapEquipment } from '../lib/swapPrefs.js';
import { useScrollLock } from '../lib/scrollLock.js';
import { CloseButton } from './ui/Dialog.jsx';
import Icon from './ui/Icon.jsx';

const INITIAL_VISIBLE = 8;

// Bewertung als farbiger Text: grün nur für „gleichwertig", Akzent für „gut".
const RATING_COLOR = {
  equal: 'var(--success)',
  good: 'var(--primary)',
  partial: 'var(--muted)',
};

// Filter-Chips in einer Mulde: gewählt = erhaben mit Textfarbe, sonst gedämpft.
const chipStyle = (active) => ({
  flex: '0 0 auto',
  background: 'var(--bg)',
  border: 'none',
  boxShadow: active ? 'var(--shadow-raised-sm), inset 1px 1px 0 var(--neu-rim)' : 'none',
  color: active ? 'var(--text)' : 'var(--muted)',
  fontWeight: active ? 600 : 500,
  borderRadius: 999,
  padding: '0 14px',
  fontSize: 14,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  minHeight: 44,
});

function prescription(entry, sets) {
  if (entry.type === 'time' || entry.type === 'cardio') {
    return `${sets} × ${formatDuration(entry.target_seconds)}`;
  }
  const weight = entry.default_weight_kg ? ` @ ${entry.default_weight_kg} kg` : '';
  return `${sets} × ${entry.target_reps}${weight}`;
}

/**
 * Bottom-Sheet „Übung tauschen": Alternativen aus der Bibliothek, sortiert nach
 * Passung, mit Geräte-Filter (gemerkt) und Erklärung, warum die Alternative passt.
 */
export default function ExerciseSwapSheet({
  exercise,
  originalName,
  dayExercises = [],
  loggedCount = 0,
  onPick,
  onRevert,
  onClose,
}) {
  const [equipment, setEquipment] = useState(() => new Set(getSwapEquipment()));
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  useScrollLock();

  const zones = exerciseZones(exercise);
  const excludeIds = useMemo(() => new Set(dayExercises.map((ex) => ex.id)), [dayExercises]);
  const excludeNames = useMemo(
    () => new Set(dayExercises.map((ex) => String(ex.name ?? '').toLowerCase().trim())),
    [dayExercises]
  );
  const ranked = useMemo(
    () => rankAlternatives(exercise, { equipment, excludeIds, excludeNames, query }),
    [exercise, equipment, excludeIds, excludeNames, query]
  );
  const visible = showAll || query ? ranked : ranked.slice(0, INITIAL_VISIBLE);

  function toggleEquipment(key) {
    const next = new Set(equipment);
    if (key === null) next.clear();
    else if (next.has(key)) next.delete(key);
    else next.add(key);
    setEquipment(next);
    setSwapEquipment(next);
  }

  const zoneLine = [...zones.primary.map((k) => ZONE_LABELS[k] ?? k)].join(', ');

  return (
    <div
      onClick={onClose}
      role="presentation"
      className="ui-scrim"
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        zIndex: 80,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ui-rise"
        role="dialog"
        aria-modal="true"
        aria-label={`Alternative für ${exercise.name}`}
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg)',
          boxShadow: 'var(--shadow-card)',
          borderRadius: '28px 28px 0 0',
          padding: '20px 20px calc(14px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
          <div style={{ minWidth: 0, paddingTop: 4 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' }}>Übung tauschen</h2>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>
              Statt <span style={{ color: 'var(--text)' }}>{exercise.name}</span>
              {zoneLine && ` · ${zoneLine}`}
            </div>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        {onRevert && originalName && (
          <button
            type="button"
            onClick={onRevert}
            className="btn btn-secondary"
            style={{
              marginTop: 14,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              background: 'var(--bg)',
              border: 'none',
              borderRadius: 20,
              padding: '12px 16px',
              minHeight: 48,
              color: 'var(--text)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <Icon name="undo" size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <span>
              Zurück zu <strong>{originalName}</strong> (Original aus dem Plan)
            </span>
          </button>
        )}

        {loggedCount > 0 && (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>
            {loggedCount === 1
              ? `Ein geloggter Satz von ${exercise.name} bleibt in dieser Session gespeichert.`
              : `${loggedCount} geloggte Sätze von ${exercise.name} bleiben in dieser Session gespeichert.`}
          </p>
        )}

        <input
          type="search"
          className="ui-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Andere Übung suchen…"
          aria-label="Übung suchen"
          style={{ marginTop: 16, flexShrink: 0 }}
        />

        <div
          className="chip-rail"
          role="group"
          aria-label="Gerät filtern"
          style={{
            marginTop: 12,
            padding: 5,
            gap: 4,
            borderRadius: 999,
            background: 'var(--bg)',
            boxShadow: 'var(--shadow-inset-sm)',
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={() => toggleEquipment(null)}
            aria-pressed={equipment.size === 0}
            style={chipStyle(equipment.size === 0)}
          >
            Alle Geräte
          </button>
          {EQUIPMENT.filter((item) => item.key !== 'cardio').map((item) => (
            <button
              key={item.key}
              type="button"
              className="btn"
              onClick={() => toggleEquipment(item.key)}
              aria-pressed={equipment.has(item.key)}
              style={chipStyle(equipment.has(item.key))}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, overflowY: 'auto', overscrollBehavior: 'contain', flex: 1, minHeight: 0, padding: '2px 2px 4px' }}>
          {visible.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '8px 0' }}>
              {equipment.size ? 'Keine passende Alternative mit diesem Gerät. Filter lockern?' : 'Nichts gefunden.'}
            </p>
          )}
          {visible.length > 0 && (
            <ul className="ui-tray">
              {visible.map(({ entry, rating, reasons }) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="ui-row"
                    onClick={() => onPick(entry)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      borderRadius: 16,
                      padding: '14px 10px',
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontWeight: 600, fontSize: 16, minWidth: 0 }}>{entry.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }}>
                        {equipmentLabel(entry.equipment)}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 3 }}>
                      <span style={{ color: RATING_COLOR[rating.key], fontWeight: 600 }}>{rating.label}</span>
                      <span style={{ color: 'var(--muted)' }}> · {prescription(entry, exercise.sets ?? entry.sets)}</span>
                    </div>
                    <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 13, color: 'var(--muted)', lineHeight: 1.45 }}>
                      {reasons.map((reason) => (
                        <li key={reason.kind} style={{ color: reason.kind === 'missing' ? 'var(--danger)' : undefined }}>
                          {reason.text}
                        </li>
                      ))}
                    </ul>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!showAll && !query && ranked.length > INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                display: 'block',
                width: '100%',
                minHeight: 44,
                marginTop: 8,
                background: 'none',
                border: 'none',
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--primary)',
                cursor: 'pointer',
              }}
            >
              {ranked.length - INITIAL_VISIBLE} weitere anzeigen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
