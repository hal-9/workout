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
