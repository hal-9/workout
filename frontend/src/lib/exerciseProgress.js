export const TREND_LABELS = {
  up: { text: '↑ besser', color: 'var(--success)' },
  same: { text: '→ gleich', color: 'var(--muted)' },
  down: { text: '↓ weniger', color: 'var(--accent)' },
};

export const formatProgressDelta = (first, latest, metricLabel) => {
  if (first == null || latest == null) return null;
  if (first === latest) return `${latest} ${metricLabel}`;
  return `${first} → ${latest} ${metricLabel}`;
};

export const formatPlanSince = (planSince) => {
  if (!planSince) return null;
  const date = new Date(planSince.replace(' ', 'T') + 'Z');
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const exercisesBeyondHighlights = (highlights, exercises) => {
  const highlightIds = new Set((highlights ?? []).map((e) => e.exercise_id));
  return (exercises ?? []).filter((e) => !highlightIds.has(e.exercise_id));
};
