import { durationUnitLabel, toInputValue } from 'shared/duration';

// Kompakte Zeile statt aufgeklapptem Formular: Name, Vorgabe, Reihenfolge.
// Alle Felder liegen im Blatt, das ein Tap auf die Zeile öffnet.
export function exerciseSummary(exercise) {
  const parts = [`${exercise.sets || 0} ×`];
  if (exercise.type === 'time' || exercise.type === 'cardio') {
    parts.push(`${toInputValue(exercise.target_seconds, exercise.type) || '–'} ${durationUnitLabel(exercise.type)}`);
  } else {
    parts.push(`${exercise.target_reps || '–'} Wdh.`);
  }
  if (exercise.type === 'wt' && exercise.default_weight_kg) parts.push(`· ${exercise.default_weight_kg} kg`);
  return parts.join(' ');
}

const iconBtnStyle = {
  width: 36,
  height: 36,
  flexShrink: 0,
  background: 'var(--surface2)',
  border: '1px solid var(--line)',
  borderRadius: 9,
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  cursor: 'pointer',
};

export default function ExerciseRow({ exercise, index, total, onEdit, onMoveUp, onMoveDown }) {
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 6, marginBottom: 8 }}>
      <button
        type="button"
        onClick={onEdit}
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'var(--surface2)',
          border: '1px solid var(--line)',
          borderRadius: 11,
          padding: '10px 12px',
          minHeight: 44,
          color: 'var(--text)',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.name || 'Unbenannte Übung'}
        </div>
        <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>
          {exerciseSummary(exercise)}
        </div>
      </button>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={index === 0}
        aria-label={`${exercise.name || 'Übung'} nach oben`}
        style={{ ...iconBtnStyle, opacity: index === 0 ? 0.4 : 1 }}
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={index === total - 1}
        aria-label={`${exercise.name || 'Übung'} nach unten`}
        style={{ ...iconBtnStyle, opacity: index === total - 1 ? 0.4 : 1 }}
      >
        ↓
      </button>
    </div>
  );
}
