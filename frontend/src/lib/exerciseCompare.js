import { plannedSetCount } from './setRows.js';
import { formatDuration, fromInputValue } from 'shared/duration';
import { isBandAssisted } from 'shared/bandAssist';

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

function bandLabel(count) {
  const bands = Number(count) || 0;
  return bands === 0 ? 'ohne Band' : bands === 1 ? '1 Band' : `${bands} Bänder`;
}

// Letzte Leistung als Zielwert: die Vorbelegung kommt aus der Historie, die
// Zielzeile zeigte aber den Plan („3 × 5-8" neben einer 10) — eine Quelle für beide.
export function lastPerformed(exercise, prefillSets) {
  if (!prefillSets?.length) return null;
  if (exercise.type === 'time' || exercise.type === 'cardio') {
    const durations = prefillSets.map((s) => s.duration_s).filter((v) => v != null);
    if (!durations.length) return null;
    return { seconds: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) };
  }
  const reps = prefillSets.map((s) => s.reps).filter((v) => v != null);
  if (!reps.length) return null;
  return { reps: reps.every((r) => r === reps[0]) ? String(reps[0]) : reps.join('/') };
}

export function formatLastSummary(exercise, prefillSets) {
  const last = lastPerformed(exercise, prefillSets);
  if (!last) return null;

  if (exercise.type === 'time' || exercise.type === 'cardio') {
    const base = `${prefillSets.length}× ${formatDuration(last.seconds)}`;
    return isBandAssisted(exercise) ? `${base} · ${bandLabel(prefillSets[0]?.band_count)}` : base;
  }

  const weight = prefillSets.find((s) => s.weight_kg != null)?.weight_kg;
  const base = `${prefillSets.length}×${last.reps}`;
  if (exercise.type === 'wt' && weight != null) {
    return `${base} @ ${weight} kg`;
  }
  if (isBandAssisted(exercise)) {
    return `${base} · ${bandLabel(prefillSets[0]?.band_count)}`;
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
  const planned = plannedSetCount(exercise);
  const logged = currentRows.filter((r) => r.logged);
  return logged.length >= planned && planned > 0;
}

export function compareExercise(exercise, currentRows, prefillSets) {
  const lastSummary = formatLastSummary(exercise, prefillSets);
  const targetLabel = formatTargetLabel(exercise);
  const last = lastPerformed(exercise, prefillSets);

  if (!plannedSetsComplete(exercise, currentRows) || !prefillSets?.length) {
    return { lastSummary, targetLabel, last, trend: null };
  }

  const currentLogged = currentRows
    .filter((r) => r.logged)
    .slice(0, plannedSetCount(exercise))
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

  return { lastSummary, targetLabel, last, trend };
}
