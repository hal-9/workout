import { formatDuration, fromInputValue } from 'shared/duration';
import { pickRecord, sessionMetrics } from 'shared/records';

export const RECORD_KIND_LABELS = {
  weight: 'Gewicht',
  e1rm: 'Est. 1RM',
  volume: 'Volumen',
  reps: 'Wiederholungen',
  duration: 'Dauer',
};

export function formatRecordValue(kind, value) {
  if (value == null) return '—';
  if (kind === 'duration') return formatDuration(value);
  if (kind === 'reps') return `${value} Wdh.`;
  return `${Math.round(value * 10) / 10} kg`;
}

// UI-Zeilen (Anzeige-Einheiten, teils leer) in API-Sätze übersetzen.
export function loggedSetsFromRows(exercise, rows = []) {
  return rows
    .filter((row) => row.logged)
    .map((row) => ({
      reps: row.reps !== '' && row.reps != null ? Number(row.reps) : null,
      weight_kg: row.weight_kg !== '' && row.weight_kg != null ? Number(row.weight_kg) : null,
      duration_s: fromInputValue(row.duration, exercise.type),
    }));
}

/**
 * Rekord-Vorschau während des Trainings: vergleicht die bereits abgehakten Sätze
 * mit den Bestwerten aus /stats. Ohne Historie kein Rekord.
 */
export function livePreviewRecord(exercise, rows, best) {
  if (!best || !best.sessions_count) return null;
  const sets = loggedSetsFromRows(exercise, rows);
  if (!sets.length) return null;
  return pickRecord(exercise, sessionMetrics(exercise, sets), best);
}

export function bestsByExerciseId(records = []) {
  return new Map(records.map((record) => [record.exercise_id, record]));
}

// Primärer Bestwert einer Übung für die Rekord-Liste.
export function primaryBest(record) {
  if (!record) return null;
  if (record.type === 'wt') {
    if (record.max_weight != null) return { kind: 'weight', value: record.max_weight };
    return null;
  }
  if (record.type === 'bw') {
    return record.max_reps != null ? { kind: 'reps', value: record.max_reps } : null;
  }
  return record.max_duration != null ? { kind: 'duration', value: record.max_duration } : null;
}
