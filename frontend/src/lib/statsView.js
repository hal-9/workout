import { localDateKey } from './dates.js';
import { groupSessionsByWeek } from './weekRecap.js';
import { primaryBest } from './records.js';

// Tonnage pro lokaler Trainingswoche — Wochenlogik kommt aus weekRecap/dates.
export function tonnageByWeek(sessions = [], weeksCount = 12) {
  return groupSessionsByWeek(sessions, weeksCount).map((bucket) => ({
    week_start: localDateKey(bucket.weekStart),
    label: bucket.weekStart.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    tonnage_kg: bucket.sessions.reduce((sum, s) => sum + (Number(s.tonnage_kg) || 0), 0),
    sessions: bucket.sessions.length,
  }));
}

export function hasTonnage(weeks = []) {
  return weeks.some((week) => week.tonnage_kg > 0);
}

export function topMuscles(volumeByMuscle = [], limit = 6) {
  const top = [...volumeByMuscle].sort((a, b) => b.sets - a.sets).slice(0, limit);
  const max = top.reduce((acc, entry) => Math.max(acc, entry.sets), 0);
  return top.map((entry) => ({ ...entry, share: max > 0 ? entry.sets / max : 0 }));
}

// Rekord-Liste: nur Übungen mit Bestwert, häufigste zuerst.
export function recordList(records = [], limit = 8) {
  return records
    .map((record) => ({ record, best: primaryBest(record) }))
    .filter((entry) => entry.best != null)
    .sort((a, b) => b.record.sessions_count - a.record.sessions_count)
    .slice(0, limit)
    .map(({ record, best }) => ({
      exercise_id: record.exercise_id,
      name: record.name,
      muscle: record.muscle,
      type: record.type,
      sessions_count: record.sessions_count,
      kind: best.kind,
      value: best.value,
      e1rm: record.type === 'wt' ? record.max_e1rm : null,
    }));
}
