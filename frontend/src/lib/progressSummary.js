import { formatProposalChange } from './progressionView.js';

// Drei Aussagen für den Kopf des Fortschritt-Tabs: Halte ich durch? Werde ich
// stärker? Was kommt als Nächstes? Alles abgeleitet aus Daten, die der Tab
// ohnehin lädt — keine zusätzlichen Requests.

// Stärkster relativer Zuwachs. Relativ, damit 20 → 25 kg nicht automatisch
// hinter 100 → 105 kg landet.
export function biggestGain(exercises = []) {
  let best = null;
  for (const ex of exercises) {
    if (ex.first_value == null || ex.latest_value == null) continue;
    if (ex.sessions_count < 2 || ex.first_value <= 0) continue;
    const gain = (ex.latest_value - ex.first_value) / ex.first_value;
    if (gain <= 0) continue;
    if (!best || gain > best.gain) best = { gain, exercise: ex };
  }
  return best;
}

export function buildProgressSummary({ weekRecap, exercises, proposals } = {}) {
  const items = [];

  if (weekRecap?.weeks?.length) {
    const detail =
      weekRecap.streak > 0
        ? `Serie: ${weekRecap.streak} Woche${weekRecap.streak === 1 ? '' : 'n'}`
        : `Ziel: ${weekRecap.total} pro Woche`;
    items.push({
      key: 'consistency',
      label: `Ø Workouts (${weekRecap.weeks.length} Wochen)`,
      value: `${weekRecap.averageDone}/${weekRecap.total}`,
      detail,
    });
  }

  const best = biggestGain(exercises);
  if (best) {
    const { exercise } = best;
    items.push({
      key: 'strength',
      label: 'Stärkster Zuwachs',
      value: `+${Math.round(best.gain * 100)} %`,
      detail: `${exercise.name}: ${exercise.first_value} → ${exercise.latest_value} ${exercise.metric_label}`,
    });
  }

  const next = proposals?.[0];
  if (next) {
    items.push({
      key: 'milestone',
      label: 'Nächster Schritt',
      value: formatProposalChange(next),
      detail: next.name,
    });
  }

  return items;
}
