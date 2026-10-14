import { parseTargetReps } from './exerciseProgress.js';

// Vorgabe fürs nächste Workout einer Übung: grundsätzlich exakt das, was beim
// letzten Mal geloggt wurde — pro Satz, pro Seite (15/13/12 bleibt 15/13/12).
// Nur wenn der Plan seit diesem Workout geändert wurde (übernommener Vorschlag
// oder Plan-Edit), gilt die Änderung genau einmal; danach ist das neue
// Workout wieder die Grundlage.
//
// `exerciseThen` = die Übung im Plan-Stand des letzten Workouts (null, wenn
// unbekannt — dann gibt es nichts zu vergleichen).
export function nextTargets(lastSets = [], exerciseNow, exerciseThen) {
  const rows = lastSets.map((s) => ({ ...s }));
  if (!rows.length || !exerciseNow || !exerciseThen) return rows;

  const num = (v) => (v == null || v === '' ? null : Number(v));

  const weightNow = num(exerciseNow.default_weight_kg);
  const weightThen = num(exerciseThen.default_weight_kg);
  if (exerciseNow.type === 'wt' && weightNow != null && weightNow !== weightThen) {
    // Neues Gewicht: mehr Last heißt Start am unteren Ende des Wdh.-Bereichs.
    const min = parseTargetReps(exerciseNow.target_reps)?.min ?? null;
    const heavier = weightThen == null || weightNow > weightThen;
    for (const row of rows) {
      row.weight_kg = weightNow;
      if (heavier && min != null) row.reps = min;
    }
    return rows;
  }

  const repsNow = parseTargetReps(exerciseNow.target_reps);
  const repsThen = parseTargetReps(exerciseThen.target_reps);
  if (repsNow && repsThen && repsNow.max > repsThen.max) {
    // Höherer Zielbereich: jeder Satz unter dem neuen oberen Ende bekommt
    // eine Wiederholung mehr. Pro Zeile — einseitige Seiten bleiben getrennt.
    for (const row of rows) {
      if (row.reps != null && Number(row.reps) < repsNow.max) row.reps = Number(row.reps) + 1;
    }
    return rows;
  }

  const secondsNow = num(exerciseNow.target_seconds);
  const secondsThen = num(exerciseThen.target_seconds);
  if (secondsNow != null && secondsThen != null && secondsNow > secondsThen) {
    for (const row of rows) {
      if (row.duration_s != null) row.duration_s = Math.max(Number(row.duration_s), secondsNow);
    }
  }
  return rows;
}

export function findPlanExercise(plan, exerciseId) {
  for (const day of plan?.days ?? []) {
    const hit = day.exercises?.find((e) => e.id === exerciseId);
    if (hit) return hit;
  }
  return null;
}
