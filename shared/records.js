import { isCooldown } from './exerciseProgress.js';

// Epley-Formel — Schätzung des Einer-Maximums aus einem Arbeitssatz.
export function estimateOneRepMax(weightKg, reps) {
  if (!weightKg || !reps || reps < 1) return null;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

// Tonnage nur für Gewichtsübungen — Wiederholungen und Sekunden lassen sich nicht in kg addieren.
export function setTonnage(exercise, set) {
  if (exercise?.type !== 'wt') return 0;
  const reps = Number(set?.reps) || 0;
  const weight = Number(set?.weight_kg) || 0;
  return reps * weight;
}

export function sessionTonnage(exercise, sets = []) {
  return sets.reduce((sum, set) => sum + setTonnage(exercise, set), 0);
}

// Kennzahlen einer einzelnen Session für eine Übung.
export function sessionMetrics(exercise, sets = []) {
  const numbers = (pick) => sets.map(pick).map(Number).filter((v) => Number.isFinite(v) && v > 0);

  const reps = numbers((s) => s.reps);
  const weights = numbers((s) => s.weight_kg);
  const durations = numbers((s) => s.duration_s);

  const e1rms = sets
    .map((s) => estimateOneRepMax(Number(s.weight_kg), Number(s.reps)))
    .filter((v) => v != null);

  return {
    max_weight: weights.length ? Math.max(...weights) : null,
    max_reps: reps.length ? Math.max(...reps) : null,
    max_duration: durations.length ? Math.max(...durations) : null,
    max_e1rm: e1rms.length ? Math.max(...e1rms) : null,
    volume: exercise?.type === 'wt' ? sessionTonnage(exercise, sets) : null,
  };
}

const METRIC_KEYS = ['max_weight', 'max_reps', 'max_duration', 'max_e1rm', 'volume'];

export function mergeBests(a, b) {
  const merged = {};
  for (const key of METRIC_KEYS) {
    const values = [a?.[key], b?.[key]].filter((v) => v != null);
    merged[key] = values.length ? Math.max(...values) : null;
  }
  return merged;
}

// Bestwerte einer Übung über beliebig viele Sessions.
export function bestsForExercise(exercise, sessions = []) {
  return sessions
    .map((session) => sessionMetrics(exercise, session.setsByExercise?.get(exercise.id) ?? []))
    .reduce((acc, metrics) => mergeBests(acc, metrics), {});
}

// Pro Übung wird höchstens ein Rekord gemeldet — in dieser Reihenfolge.
const RECORD_PRIORITY = {
  wt: [
    { kind: 'weight', metric: 'max_weight', unit: 'kg' },
    { kind: 'e1rm', metric: 'max_e1rm', unit: 'kg' },
    { kind: 'volume', metric: 'volume', unit: 'kg' },
  ],
  bw: [
    { kind: 'reps', metric: 'max_reps', unit: 'Wdh.' },
  ],
  time: [
    { kind: 'duration', metric: 'max_duration', unit: 's' },
  ],
  cardio: [
    { kind: 'duration', metric: 'max_duration', unit: 's' },
  ],
};

/**
 * Vergleicht die Kennzahlen einer Session mit früheren Bestwerten und liefert
 * höchstens einen Rekord — den ersten Treffer nach RECORD_PRIORITY.
 */
export function pickRecord(exercise, current, previous) {
  for (const { kind, metric, unit } of RECORD_PRIORITY[exercise?.type] ?? []) {
    const value = current?.[metric];
    const before = previous?.[metric];
    if (value == null || before == null || value <= before) continue;
    return { kind, metric, unit, value, previous: before };
  }
  return null;
}

export function exercisesByIdFromPlan(plan) {
  const map = new Map();
  for (const day of plan?.days ?? []) {
    for (const ex of day.exercises ?? []) {
      if (isCooldown(ex)) continue;
      map.set(ex.id, ex);
    }
  }
  return map;
}

/**
 * Vergleicht die Sätze einer gerade beendeten Session mit allen früheren Sessions.
 * Erste Session einer Übung zählt nicht als Rekord — sonst wäre alles ein Rekord.
 */
export function detectNewRecords(plan, currentSetsByExercise, previousSessions = []) {
  const exercises = exercisesByIdFromPlan(plan);
  const records = [];

  for (const [exerciseId, sets] of currentSetsByExercise) {
    const exercise = exercises.get(exerciseId);
    if (!exercise) continue;

    const history = previousSessions.filter((s) => s.setsByExercise?.get(exerciseId)?.length);
    if (!history.length) continue;

    const record = pickRecord(
      exercise,
      sessionMetrics(exercise, sets),
      bestsForExercise(exercise, history)
    );
    if (!record) continue;

    records.push({
      exercise_id: exerciseId,
      name: exercise.name,
      type: exercise.type,
      kind: record.kind,
      unit: record.unit,
      value: record.value,
      previous: record.previous,
    });
  }

  return records;
}
