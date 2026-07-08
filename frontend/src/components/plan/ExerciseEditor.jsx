import { EXERCISE_TYPES } from '../../lib/planDefaults.js';

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 9,
  padding: '10px 12px',
  fontSize: 15,
};

const labelStyle = {
  display: 'block',
  fontSize: 12,
  color: 'var(--muted)',
  marginBottom: 4,
  marginTop: 10,
};

const smallBtnStyle = {
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  color: 'var(--text)',
};

export default function ExerciseEditor({
  exercise,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}) {
  const showReps = exercise.type === 'bw' || exercise.type === 'wt';
  const showWeight = exercise.type === 'wt';
  const showSeconds = exercise.type === 'time' || exercise.type === 'cardio';

  const handleTypeChange = (type) => {
    const next = { ...exercise, type };
    if (type === 'time' || type === 'cardio') {
      next.target_reps = null;
      next.target_seconds = next.target_seconds ?? 30;
      next.default_weight_kg = null;
    } else if (type === 'wt') {
      next.target_reps = next.target_reps ?? '8-12';
      next.target_seconds = null;
    } else {
      next.target_reps = next.target_reps ?? '8-12';
      next.target_seconds = null;
      next.default_weight_kg = null;
    }
    onChange(next);
  };

  return (
    <div
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Übung {index + 1}</strong>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            style={smallBtnStyle}
            aria-label="Übung nach oben"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            style={smallBtnStyle}
            aria-label="Übung nach unten"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={total <= 1}
            style={{ ...smallBtnStyle, color: 'var(--danger)' }}
            aria-label="Übung entfernen"
          >
            Entfernen
          </button>
        </div>
      </div>

      <label style={labelStyle}>Name</label>
      <input
        type="text"
        value={exercise.name}
        onChange={(e) => onChange({ ...exercise, name: e.target.value })}
        style={inputStyle}
        placeholder="z. B. Liegestütze"
      />

      <label style={labelStyle}>Muskelgruppe</label>
      <input
        type="text"
        value={exercise.muscle}
        onChange={(e) => onChange({ ...exercise, muscle: e.target.value })}
        style={inputStyle}
        placeholder="z. B. Brust"
      />

      <label style={labelStyle}>Typ</label>
      <select
        value={exercise.type}
        onChange={(e) => handleTypeChange(e.target.value)}
        style={inputStyle}
      >
        {EXERCISE_TYPES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <label style={labelStyle}>Sätze</label>
      <input
        type="number"
        min={1}
        max={20}
        value={exercise.sets}
        onChange={(e) => onChange({ ...exercise, sets: e.target.value })}
        style={inputStyle}
      />

      {showReps && (
        <>
          <label style={labelStyle}>Wiederholungen</label>
          <input
            type="text"
            value={exercise.target_reps ?? ''}
            onChange={(e) => onChange({ ...exercise, target_reps: e.target.value })}
            style={inputStyle}
            placeholder="z. B. 8-12"
          />
        </>
      )}

      {showWeight && (
        <>
          <label style={labelStyle}>Startgewicht (kg, optional)</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={exercise.default_weight_kg ?? ''}
            onChange={(e) =>
              onChange({
                ...exercise,
                default_weight_kg: e.target.value === '' ? null : e.target.value,
              })
            }
            style={inputStyle}
            placeholder="z. B. 10"
          />
        </>
      )}

      {showSeconds && (
        <>
          <label style={labelStyle}>Sekunden</label>
          <input
            type="number"
            min={1}
            value={exercise.target_seconds ?? ''}
            onChange={(e) =>
              onChange({
                ...exercise,
                target_seconds: e.target.value === '' ? null : e.target.value,
              })
            }
            style={inputStyle}
            placeholder="z. B. 30"
          />
        </>
      )}

      <label style={labelStyle}>Technik-Hinweis (optional)</label>
      <textarea
        value={exercise.cue}
        onChange={(e) => onChange({ ...exercise, cue: e.target.value })}
        rows={2}
        style={{ ...inputStyle, resize: 'vertical' }}
        placeholder="Kurzer Form-Hinweis"
      />

      <label style={labelStyle}>Video-Suche (optional)</label>
      <input
        type="text"
        value={exercise.video_query}
        onChange={(e) => onChange({ ...exercise, video_query: e.target.value })}
        style={inputStyle}
        placeholder="z. B. push up form"
      />
    </div>
  );
}
