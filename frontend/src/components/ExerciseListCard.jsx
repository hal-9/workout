import { isBandAssisted } from 'shared/bandAssist';
import { equipmentLabel, splitExerciseName } from '../lib/equipment.js';
import Icon from './ui/Icon.jsx';

// Zeile in der Übungs-Mulde auf „Heute": Nummer, Name (+ Gerät), Subline.
// Erledigt = kleiner Kiesel mit Haken statt Pfeil; der Name bleibt lesbar.
export default function ExerciseListCard({ exercise, rows, subline, onOpen, index }) {
  const total = rows.length;
  const loggedCount = rows.filter((r) => r.logged).length;
  const allLogged = total > 0 && loggedCount >= total;
  const inProgress = loggedCount > 0 && !allLogged;
  // Körpergewicht steht schon in der Subline.
  const { base, variant } = splitExerciseName(exercise.name);
  const equipment = variant ?? (exercise.type === 'bw' ? null : equipmentLabel(exercise));

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${exercise.name} öffnen${allLogged ? ', erledigt' : inProgress ? `, ${loggedCount} von ${total} Sätzen` : ''}`}
      className="hx-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        borderRadius: 16,
        padding: '14px 8px',
        cursor: 'pointer',
        color: 'var(--text)',
        minHeight: 44,
      }}
    >
      {index != null && (
        <span style={{ alignSelf: 'flex-start', width: 18, fontSize: 15, fontWeight: 500, lineHeight: 1.35, color: 'var(--muted)', flexShrink: 0 }}>
          {index}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>
          {base}
          {equipment && <span style={{ fontWeight: 400, color: 'var(--muted)' }}> ({equipment})</span>}
        </div>
        {subline && (
          <div style={{ marginTop: 2, fontSize: 13, lineHeight: 1.45, color: 'var(--muted)' }}>{subline}</div>
        )}
      </div>
      {inProgress && (
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true">
          {loggedCount}/{total}
        </span>
      )}
      {allLogged ? (
        <span
          aria-hidden="true"
          style={{
            width: 24,
            height: 22,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: 'var(--on-primary)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="check" size={14} style={{ strokeWidth: 2.6 }} />
        </span>
      ) : (
        <Icon name="chevronRight" size={18} style={{ color: 'var(--muted)' }} />
      )}
    </button>
  );
}

export function buildCardSubline(exercise, rows, compare) {
  const parts = [`${exercise.sets} Sätze${exercise.unilateral ? ' pro Seite' : ''}`];

  if (exercise.type === 'bw') {
    const reps = compare.last?.reps ?? exercise.target_reps;
    if (reps) parts.push(`${reps} Wdh`);
    if (isBandAssisted(exercise)) {
      const bands = Number(rows[0]?.band_count) || 0;
      parts.push(bands === 0 ? 'ohne Band' : `${bands}× Band`);
    } else parts.push('Körpergewicht');
    return parts.join(' · ');
  }

  if (exercise.type === 'wt') {
    if (compare.targetLabel) parts.push(`Ziel ${compare.targetLabel}`);
    if (compare.lastSummary) parts.push(`Zuletzt ${compare.lastSummary}`);
    else {
      const kg = rows[0]?.weight_kg || exercise.default_weight_kg;
      if (kg) parts.push(`${kg} kg`);
    }
    return parts.join(' · ');
  }

  // time / cardio
  if (compare.targetLabel) parts.push(`Ziel ${compare.targetLabel}`);
  if (compare.lastSummary) parts.push(`Zuletzt ${compare.lastSummary}`);
  return parts.join(' · ');
}
