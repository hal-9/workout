import { formatDuration } from 'shared/duration';

// Darstellung der strukturierten Coach-Auswertung (evaluations.summary_json).

export const TREND_VIEW = {
  up: { symbol: '↑', label: 'mehr', color: 'var(--success)' },
  flat: { symbol: '→', label: 'gleich', color: 'var(--muted)' },
  down: { symbol: '↓', label: 'weniger', color: 'var(--danger)' },
  new: { symbol: '★', label: 'neu', color: 'var(--primary)' },
};

export function trendView(trend) {
  return TREND_VIEW[trend] ?? TREND_VIEW.flat;
}

/** "42,5 kg" / "12 Wdh." / "45 Sek" — der Zielwert einer übernehmbaren Empfehlung. */
export function formatHintValue(field, value) {
  if (value == null) return '';
  if (field === 'weight_kg') return `${String(Math.round(value * 10) / 10).replace('.', ',')} kg`;
  if (field === 'reps') return `${value} Wdh.`;
  if (field === 'duration_s') return formatDuration(value);
  return String(value);
}

/** Nur Empfehlungen mit Übung, Feld und Wert lassen sich übernehmen. */
export function isApplicable(recommendation) {
  return Boolean(
    recommendation?.exercise_id && recommendation?.field && Number.isFinite(recommendation?.value)
  );
}

/** Stabiler Schlüssel für den Übernahme-Status einer Empfehlung. */
export function hintKey(recommendation) {
  return `${recommendation.exercise_id}:${recommendation.field}`;
}

/** Kurztext für die Übungskarte im Training: "Coach: 42,5 kg · 12 Wdh." */
export function describeHint(hint) {
  if (!hint) return null;
  const parts = ['weight_kg', 'reps', 'duration_s']
    .filter((field) => hint[field] != null)
    .map((field) => formatHintValue(field, hint[field]));
  return parts.length ? `Coach: ${parts.join(' · ')}` : null;
}
