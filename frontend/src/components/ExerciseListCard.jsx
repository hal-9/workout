export default function ExerciseListCard({ exercise, rows, subline, onOpen }) {
  const total = rows.length;
  const loggedCount = rows.filter((r) => r.logged).length;
  const allLogged = total > 0 && loggedCount >= total;
  const inProgress = loggedCount > 0 && !allLogged;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${exercise.name} öffnen`}
      className="ex-card"
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: 'var(--surface)',
        border: `1px solid ${inProgress ? 'var(--primary)' : 'var(--line)'}`,
        borderRadius: 16,
        padding: '13px 16px',
        cursor: 'pointer',
        opacity: allLogged ? 0.55 : 1,
        minHeight: 44,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {allLogged && (
            <span
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--bg)',
                flexShrink: 0,
              }}
            >
              ✓
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {exercise.name}
            </div>
            <div
              style={{
                marginTop: 2,
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                fontSize: 10.5,
                color: 'var(--muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {subline}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {inProgress && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 500,
                fontSize: 10,
                color: 'var(--primary)',
                background: 'var(--primary-dim)',
                padding: '2px 8px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              {loggedCount}/{total} ✓
            </span>
          )}
          <span style={{ fontSize: 18, color: 'var(--primary)' }}>›</span>
        </div>
      </div>
    </button>
  );
}

export function buildCardSubline(exercise, rows, compare) {
  const parts = [`${exercise.sets} Sätze`];

  if (exercise.type === 'bw') {
    if (exercise.target_reps) parts.push(`${exercise.target_reps} Wdh`);
    parts.push('Körpergewicht');
    return parts.join(' · ');
  }

  if (exercise.type === 'wt') {
    if (compare.lastSummary) parts.push(compare.lastSummary);
    else {
      const kg = rows[0]?.weight_kg || exercise.default_weight_kg;
      if (kg) parts.push(`${kg} kg`);
    }
    if (compare.targetLabel) parts.push(`Ziel ${compare.targetLabel}`);
    return parts.join(' · ');
  }

  // time / cardio
  if (compare.lastSummary) parts.push(compare.lastSummary);
  if (compare.targetLabel) parts.push(`Ziel ${compare.targetLabel}`);
  return parts.join(' · ');
}
