import { formatDuration, fromInputValue } from 'shared/duration';

export function parseTargetReps(targetReps) {
  if (!targetReps) return null;
  const range = String(targetReps).match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    return { min: Number(range[1]), max: Number(range[2]) };
  }
  const single = String(targetReps).match(/(\d+)/);
  if (single) {
    const n = Number(single[1]);
    return { min: n, max: n };
  }
  return null;
}

export function formatTargetLabel(exercise) {
  if (exercise.type === 'time' || exercise.type === 'cardio') {
    return exercise.target_seconds ? formatDuration(exercise.target_seconds) : null;
  }
  if (!exercise.target_reps) return null;
  const parsed = parseTargetReps(exercise.target_reps);
  if (!parsed) return `${exercise.target_reps} Wdh.`;
  if (parsed.min === parsed.max) return `${parsed.min} Wdh.`;
  return `${parsed.min}–${parsed.max} Wdh.`;
}

export function formatLastSummary(exercise, prefillSets) {
  if (!prefillSets?.length) return null;

  if (exercise.type === 'time' || exercise.type === 'cardio') {
    const durations = prefillSets.map((s) => s.duration_s).filter((v) => v != null);
    if (!durations.length) return null;
    const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    return `${prefillSets.length}× ${formatDuration(avg)}`;
  }

  const reps = prefillSets.map((s) => s.reps).filter((v) => v != null);
  if (!reps.length) return null;

  const weight = prefillSets.find((s) => s.weight_kg != null)?.weight_kg;
  const repLabel = reps.every((r) => r === reps[0]) ? String(reps[0]) : reps.join('/');
  const base = `${prefillSets.length}×${repLabel}`;
  if (exercise.type === 'wt' && weight != null) {
    return `${base} @ ${weight} kg`;
  }
  return base;
}

function exerciseVolume(exercise, sets) {
  if (!sets?.length) return 0;
  if (exercise.type === 'time' || exercise.type === 'cardio') {
    return sets.reduce((sum, s) => sum + (Number(s.duration_s) || 0), 0);
  }
  const weight = exercise.type === 'wt' ? Number(sets[0]?.weight_kg) || 1 : 1;
  return sets.reduce((sum, s) => sum + (Number(s.reps) || 0) * weight, 0);
}

function plannedSetsComplete(exercise, currentRows) {
  const planned = exercise.sets ?? 0;
  const logged = currentRows.filter((r) => r.logged);
  return logged.length >= planned && planned > 0;
}

export function compareExercise(exercise, currentRows, prefillSets) {
  const lastSummary = formatLastSummary(exercise, prefillSets);
  const targetLabel = formatTargetLabel(exercise);

  if (!plannedSetsComplete(exercise, currentRows) || !prefillSets?.length) {
    return { lastSummary, targetLabel, trend: null };
  }

  const currentLogged = currentRows
    .filter((r) => r.logged)
    .slice(0, exercise.sets)
    .map((r) => ({
      reps: r.reps !== '' ? Number(r.reps) : null,
      weight_kg: r.weight_kg !== '' ? Number(r.weight_kg) : null,
      duration_s: fromInputValue(r.duration, exercise.type),
    }));

  const lastVol = exerciseVolume(exercise, prefillSets);
  const currentVol = exerciseVolume(exercise, currentLogged);

  let trend = 'same';
  if (currentVol > lastVol) trend = 'up';
  else if (currentVol < lastVol) trend = 'down';

  return { lastSummary, targetLabel, trend };
}
