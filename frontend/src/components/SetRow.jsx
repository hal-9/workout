import { SET_TYPE_LABELS } from 'shared/setTypes';
import { durationUnitLabel, fromInputValue, toInputValue } from 'shared/duration';

const inputStyle = {
  width: 72,
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '7px 8px',
  fontFamily: 'var(--font-mono)',
  fontSize: 16,
  textAlign: 'center',
};

export default function SetRow({
  exercise,
  row,
  index,
  disabled,
  onToggle,
  onFieldChange,
  onSetTypeChange,
  onCopyPrev,
  onAdjustWeight,
  onUndo,
  canUndo,
  setRef,
}) {
  const setType = row.set_type ?? 'working';

  return (
    <div
      ref={setRef}
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
    >
      <button
        type="button"
        onClick={() => onToggle(index)}
        disabled={disabled}
        aria-pressed={row.logged}
        aria-label={`Satz ${row.set_number}${row.logged ? ' abgehakt' : ''}`}
        style={{
          width: 44,
          height: 44,
          borderRadius: 9,
          border: '1px solid var(--line)',
          background: row.logged ? 'var(--success-dim)' : 'var(--surface2)',
          color: row.logged ? 'var(--success)' : 'var(--muted)',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {row.logged ? '✓' : row.set_number}
      </button>

      {exercise.type === 'wt' && (
        <select
          value={setType}
          onChange={(e) => onSetTypeChange(index, e.target.value)}
          aria-label="Satztyp"
          style={{
            ...inputStyle,
            width: 72,
            fontSize: 11,
            padding: '6px 4px',
          }}
        >
          {Object.entries(SET_TYPE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
      )}

      {(exercise.type === 'bw' || exercise.type === 'wt') && (
        <input
          type="number"
          inputMode="numeric"
          placeholder={exercise.target_reps}
          value={row.reps}
          onChange={(e) => onFieldChange(index, 'reps', e.target.value)}
          aria-label={`Wiederholungen Satz ${row.set_number}`}
          style={inputStyle}
        />
      )}
      {exercise.type === 'wt' && (
        <>
          <input
            type="number"
            inputMode="decimal"
            placeholder="kg"
            value={row.weight_kg}
            onChange={(e) => onFieldChange(index, 'weight_kg', e.target.value)}
            aria-label={`Gewicht Satz ${row.set_number}`}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => onAdjustWeight(index, -2.5)}
            aria-label="2,5 kg weniger"
            disabled={disabled}
            style={{ width: 32, height: 36, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface2)', cursor: 'pointer' }}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => onAdjustWeight(index, 2.5)}
            aria-label="2,5 kg mehr"
            disabled={disabled}
            style={{ width: 32, height: 36, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface2)', cursor: 'pointer' }}
          >
            +
          </button>
        </>
      )}
      {(exercise.type === 'time' || exercise.type === 'cardio') && (
        <input
          type="number"
          inputMode={exercise.type === 'cardio' ? 'decimal' : 'numeric'}
          placeholder={toInputValue(exercise.target_seconds, exercise.type)}
          value={row.duration}
          onChange={(e) => onFieldChange(index, 'duration', e.target.value)}
          aria-label={`${durationUnitLabel(exercise.type)} Satz ${row.set_number}`}
          style={inputStyle}
        />
      )}

      {index > 0 && (
        <button
          type="button"
          onClick={() => onCopyPrev(index)}
          aria-label="Vorherigen Satz kopieren"
          disabled={disabled}
          style={{ fontSize: 11, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface2)', cursor: 'pointer' }}
        >
          ↻
        </button>
      )}
      {canUndo && (
        <button
          type="button"
          onClick={onUndo}
          aria-label="Letzten Satz rückgängig"
          style={{ fontSize: 11, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface2)', cursor: 'pointer' }}
        >
          ↶
        </button>
      )}
    </div>
  );
}

export function buildSetPayload(exercise, row) {
  return {
    exercise_id: exercise.id,
    set_number: row.set_number,
    reps: exercise.type === 'bw' || exercise.type === 'wt' ? Number(row.reps) || null : null,
    weight_kg: exercise.type === 'wt' ? Number(row.weight_kg) || null : null,
    duration_s:
      exercise.type === 'time' || exercise.type === 'cardio'
        ? fromInputValue(row.duration, exercise.type)
        : null,
    set_type: row.set_type ?? 'working',
    superset_group: row.superset_group ?? null,
  };
}
