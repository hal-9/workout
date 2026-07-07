import { parseTargetReps } from './exerciseCompare.js';
import { PULLUP_STAGES } from '../pullupStages.js';

function isPullupExercise(exercise) {
  const hay = `${exercise.id} ${exercise.name} ${exercise.muscle}`.toLowerCase();
  return hay.includes('pull') || hay.includes('klimmzug') || hay.includes('chin');
}

export function suggestProgression(exercise, loggedSets) {
  const planned = exercise.sets ?? 0;
  if (!loggedSets?.length || loggedSets.length < planned) return null;

  const sets = loggedSets.slice(0, planned);
  const target = parseTargetReps(exercise.target_reps);

  if (exercise.type === 'wt' && target) {
    const allAtTop = sets.every((s) => (Number(s.reps) || 0) >= target.max);
    if (!allAtTop) return null;

    const currentWeight = Number(sets[0]?.weight_kg ?? exercise.default_weight_kg ?? 0);
    const nextValue = Math.round((currentWeight + 2.5) * 10) / 10;
    return {
      type: 'weight',
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      message: `${exercise.name}: Bereit für ${nextValue} kg?`,
      nextValue,
    };
  }

  if (exercise.type === 'bw' && target) {
    const allAtTop = sets.every((s) => (Number(s.reps) || 0) >= target.max);
    if (!allAtTop) return null;

    if (isPullupExercise(exercise)) {
      return {
        type: 'pullup_stage',
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        message: `${exercise.name}: Zielbereich erreicht — nächste Klimmzug-Stufe in Fortschritt prüfen.`,
        nextValue: null,
      };
    }

    return {
      type: 'reps',
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      message: `${exercise.name}: Zielbereich erreicht — Variante aus der Technik-Notiz prüfen.`,
      nextValue: null,
    };
  }

  if ((exercise.type === 'time' || exercise.type === 'cardio') && exercise.target_seconds) {
    const allAtTarget = sets.every((s) => (Number(s.duration_s) || 0) >= exercise.target_seconds);
    if (!allAtTarget) return null;
    return {
      type: 'reps',
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      message: `${exercise.name}: Zieldauer erreicht — Intensität oder Dauer leicht steigern.`,
      nextValue: null,
    };
  }

  return null;
}

export function suggestionsFromSummary(plan, summary) {
  if (!plan?.days?.length || !summary?.exercises?.length) return [];

  const exerciseById = new Map();
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      exerciseById.set(ex.id, ex);
    }
  }

  const suggestions = [];
  for (const item of summary.exercises) {
    const exercise = exerciseById.get(item.exercise_id);
    if (!exercise) continue;
    const suggestion = suggestProgression(exercise, item.sets);
    if (suggestion) suggestions.push(suggestion);
  }
  return suggestions;
}

export function pullupStageLabel(stageIndex) {
  return PULLUP_STAGES[stageIndex]?.label ?? null;
}
