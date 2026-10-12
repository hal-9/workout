import { durationUnitLabel, toInputValue } from 'shared/duration';
import Icon from '../ui/Icon.jsx';

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
  width: 44,
  height: 44,
  flexShrink: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'none',
  border: 'none',
  borderRadius: 14,
  color: 'var(--muted)',
  cursor: 'pointer',
};

// Flache Zeile in der Übungs-Mulde des Tages; Reihenfolge über zwei Pfeil-Knöpfe.
export default function ExerciseRow({ exercise, index, total, onEdit, onMoveUp, onMoveDown }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <button
        type="button"
        onClick={onEdit}
        className="pl-press"
        style={{
          flex: 1,
          minWidth: 0,
          textAlign: 'left',
          background: 'none',
          border: 'none',
          borderRadius: 14,
          padding: '10px 6px',
          minHeight: 44,
          color: 'var(--text)',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.name || 'Unbenannte Übung'}
        </div>
        <div style={{ marginTop: 2, fontSize: 13, color: 'var(--muted)' }}>
          {exerciseSummary(exercise)}
        </div>
      </button>
      <button
        type="button"
        onClick={onMoveUp}
        disabled={index === 0}
        aria-label={`${exercise.name || 'Übung'} nach oben`}
        className="pl-press"
        style={{ ...iconBtnStyle, opacity: index === 0 ? 0.35 : 1 }}
      >
        <Icon name="chevronDown" size={18} style={{ transform: 'rotate(180deg)' }} />
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={index === total - 1}
        aria-label={`${exercise.name || 'Übung'} nach unten`}
        className="pl-press"
        style={{ ...iconBtnStyle, opacity: index === total - 1 ? 0.35 : 1 }}
      >
        <Icon name="chevronDown" size={18} />
      </button>
    </div>
  );
}
