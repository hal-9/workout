// Pläne aus der Zeit vor der Cooldown-Phase haben kein phase-Feld.
export function exercisePhase(exercise) {
  return exercise?.phase === 'cooldown' ? 'cooldown' : 'main';
}

export function isCooldown(exercise) {
  return exercisePhase(exercise) === 'cooldown';
}

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

// Cardio wird in Minuten dargestellt, time-Übungen in Sekunden.
export function toMetricUnit(type, seconds) {
  if (seconds === null || seconds === undefined) return null;
  if (type !== 'cardio') return seconds;
  return Math.round((seconds / 60) * 10) / 10;
}

export function parseExerciseTarget(exercise) {
  if (exercise.type === 'time' || exercise.type === 'cardio') {
    return exercise.target_seconds
      ? { duration: toMetricUnit(exercise.type, exercise.target_seconds) }
      : {};
  }
  const parsed = parseTargetReps(exercise.target_reps);
  if (!parsed) return {};
  return { min: parsed.min, max: parsed.max };
}

export function metricLabelForType(type) {
  if (type === 'wt') return 'kg';
  if (type === 'cardio') return 'Min.';
  if (type === 'time') return 's';
  return 'Wdh.';
}

export function sessionMetric(exercise, sets) {
  if (!sets?.length) return null;

  if (exercise.type === 'time' || exercise.type === 'cardio') {
    const durations = sets.map((s) => Number(s.duration_s)).filter((v) => !Number.isNaN(v) && v > 0);
    return durations.length ? toMetricUnit(exercise.type, Math.max(...durations)) : null;
  }

  if (exercise.type === 'wt') {
    const weights = sets.map((s) => Number(s.weight_kg)).filter((v) => !Number.isNaN(v) && v > 0);
    return weights.length ? Math.max(...weights) : null;
  }

  const reps = sets.map((s) => Number(s.reps)).filter((v) => !Number.isNaN(v) && v > 0);
  return reps.length ? Math.max(...reps) : null;
}

export function computeTrend(points) {
  if (points.length < 2) return null;
  const prev = points[points.length - 2].value;
  const latest = points[points.length - 1].value;
  if (latest > prev) return 'up';
  if (latest < prev) return 'down';
  return 'same';
}

const COMPOUND_PATTERN =
  /squat|kniebeuge|deadlift|kreuzheben|bench|bankdr|row|rudern|pull|klimmzug|chin|press|drück/i;

export function isCompoundExercise(exercise) {
  const hay = `${exercise.id} ${exercise.name} ${exercise.muscle}`;
  return COMPOUND_PATTERN.test(hay);
}

export function scoreExercise(exercise, sessionsCount) {
  let score = sessionsCount * 10;
  if (exercise.type === 'wt') score += 50;
  if (isCompoundExercise(exercise)) score += 30;
  return score;
}

export function groupLogsBySession(rows) {
  const sessions = new Map();

  for (const row of rows) {
    if (!sessions.has(row.session_id)) {
      sessions.set(row.session_id, {
        session_id: row.session_id,
        finished_at: row.finished_at,
        setsByExercise: new Map(),
      });
    }
    const session = sessions.get(row.session_id);
    if (!session.setsByExercise.has(row.exercise_id)) {
      session.setsByExercise.set(row.exercise_id, []);
    }
    session.setsByExercise.get(row.exercise_id).push({
      set_number: row.set_number,
      reps: row.reps,
      weight_kg: row.weight_kg,
      duration_s: row.duration_s,
    });
  }

  return [...sessions.values()].sort((a, b) => a.finished_at.localeCompare(b.finished_at));
}

export function buildExerciseProgressList(plan, sessionLogs) {
  const exerciseById = new Map();
  for (const day of plan.days ?? []) {
    for (const ex of day.exercises ?? []) {
      // Cooldown-Stretches sind keine Fortschritts-Metrik.
      if (isCooldown(ex)) continue;
      exerciseById.set(ex.id, ex);
    }
  }

  const pointsByExercise = new Map();
  for (const session of sessionLogs) {
    const date = session.finished_at.slice(0, 10);
    for (const [exerciseId, sets] of session.setsByExercise) {
      const exercise = exerciseById.get(exerciseId);
      if (!exercise) continue;
      const value = sessionMetric(exercise, sets);
      if (value === null) continue;
      if (!pointsByExercise.has(exerciseId)) pointsByExercise.set(exerciseId, []);
      pointsByExercise.get(exerciseId).push({
        date,
        value,
        session_id: session.session_id,
      });
    }
  }

  const exercises = [];
  for (const [exerciseId, exercise] of exerciseById) {
    const points = pointsByExercise.get(exerciseId) ?? [];
    const first_value = points.length ? points[0].value : null;
    const latest_value = points.length ? points[points.length - 1].value : null;

    exercises.push({
      exercise_id: exerciseId,
      name: exercise.name,
      muscle: exercise.muscle,
      type: exercise.type,
      metric_label: metricLabelForType(exercise.type),
      target: parseExerciseTarget(exercise),
      points,
      first_value,
      latest_value,
      trend: computeTrend(points),
      sessions_count: points.length,
      _score: scoreExercise(exercise, points.length),
    });
  }

  exercises.sort((a, b) => b._score - a._score);

  const withData = exercises.filter((e) => e.points.length > 0);
  const stripScore = ({ _score, ...rest }) => rest;

  return {
    highlights: withData.slice(0, 5).map(stripScore),
    exercises: exercises.map(stripScore),
  };
}
