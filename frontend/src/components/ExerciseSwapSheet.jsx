import { useMemo, useState } from 'react';
import { formatDuration } from 'shared/duration';
import { EQUIPMENT, ZONE_LABELS, exerciseZones } from 'shared/muscles';
import { equipmentLabel, rankAlternatives } from '../lib/exerciseSwap.js';
import { getSwapEquipment, setSwapEquipment } from '../lib/swapPrefs.js';

const INITIAL_VISIBLE = 8;

const RATING_STYLE = {
  equal: { color: 'var(--success)', bg: 'var(--success-dim)' },
  good: { color: 'var(--primary)', bg: 'var(--primary-dim)' },
  partial: { color: 'var(--muted)', bg: 'var(--surface2)' },
};

const chipStyle = (active) => ({
  flex: '0 0 auto',
  background: active ? 'var(--primary-dim)' : 'var(--surface2)',
  border: `1px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
  color: active ? 'var(--primary)' : 'var(--muted)',
  borderRadius: 999,
  padding: '7px 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  minHeight: 32,
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'flex-end',
        background: 'rgba(46, 36, 64, 0.28)',
        WebkitBackdropFilter: 'blur(6px)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ed-sheet glass"
        role="dialog"
        aria-modal="true"
        aria-label={`Alternative für ${exercise.name}`}
        style={{
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px 20px 0 0',
          padding: '18px 18px calc(14px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 17 }}>Übung tauschen</h3>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
              Statt <span style={{ color: 'var(--text)' }}>{exercise.name}</span>
              {zoneLine && ` · ${zoneLine}`}
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

        {onRevert && originalName && (
          <button
            type="button"
            onClick={onRevert}
            style={{
              marginTop: 12,
              textAlign: 'left',
              background: 'var(--surface2)',
              border: '1px dashed var(--line)',
              borderRadius: 12,
              padding: '10px 12px',
              color: 'var(--text)',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ↩ Zurück zu <strong>{originalName}</strong> (Original aus dem Plan)
          </button>
        )}

        {loggedCount > 0 && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' }}>
            {loggedCount === 1
              ? `Ein geloggter Satz von ${exercise.name} bleibt in dieser Session gespeichert.`
              : `${loggedCount} geloggte Sätze von ${exercise.name} bleiben in dieser Session gespeichert.`}
          </p>
        )}

        <div
          style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '12px -2px 0', padding: '0 2px 4px' }}
          aria-label="Gerät filtern"
        >
          <button type="button" onClick={() => toggleEquipment(null)} style={chipStyle(equipment.size === 0)}>
            Alle Geräte
          </button>
          {EQUIPMENT.filter((item) => item.key !== 'cardio').map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleEquipment(item.key)}
              aria-pressed={equipment.has(item.key)}
              style={chipStyle(equipment.has(item.key))}
            >
              {item.label}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Andere Übung suchen…"
          style={{
            width: '100%',
            background: 'var(--surface2)',
            border: '1px solid var(--line)',
            color: 'var(--text)',
            borderRadius: 10,
            padding: '9px 11px',
            fontSize: 15,
            marginTop: 8,
          }}
        />

        <div style={{ marginTop: 10, overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visible.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '8px 0' }}>
              {equipment.size ? 'Keine passende Alternative mit diesem Gerät. Filter lockern?' : 'Nichts gefunden.'}
            </p>
          )}
          {visible.map(({ entry, rating, reasons }) => {
            const style = RATING_STYLE[rating.key];
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onPick(entry)}
                style={{
                  textAlign: 'left',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 14,
                  padding: '11px 13px',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, minWidth: 0 }}>{entry.name}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                    {equipmentLabel(entry.equipment)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      padding: '2px 8px',
                      borderRadius: 999,
                      color: style.color,
                      background: style.bg,
                    }}
                  >
                    {rating.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
                    {prescription(entry, exercise.sets ?? entry.sets)}
                  </span>
                </div>
                <ul style={{ margin: '7px 0 0', paddingLeft: 16, fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>
                  {reasons.map((reason) => (
                    <li key={reason.kind} style={{ color: reason.kind === 'missing' ? 'var(--danger)' : undefined }}>
                      {reason.text}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
          {!showAll && !query && ranked.length > INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: '6px 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
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
