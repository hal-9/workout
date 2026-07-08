export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
}

export function uniqueSlug(base, existing) {
  let slug = base;
  let counter = 2;
  while (existing.has(slug)) {
    slug = `${base}-${counter}`;
    counter += 1;
  }
  existing.add(slug);
  return slug;
}

export const EXERCISE_TYPES = [
  { value: 'bw', label: 'Körpergewicht' },
  { value: 'wt', label: 'Mit Gewicht' },
  { value: 'time', label: 'Halten / Zeit' },
  { value: 'cardio', label: 'Cardio' },
];

export const EXERCISE_TYPE_LABELS = Object.fromEntries(
  EXERCISE_TYPES.map(({ value, label }) => [value, label])
);

export function createEmptyExercise(existingIds = new Set()) {
  const id = uniqueSlug('neue-uebung', existingIds);
  return {
    id,
    name: '',
    muscle: '',
    type: 'bw',
    sets: 3,
    target_reps: '8-12',
    target_seconds: null,
    default_weight_kg: null,
    cue: '',
    video_query: '',
  };
}

export function createEmptyDay(existingKeys = new Set()) {
  const key = uniqueSlug('tag', existingKeys);
  const exerciseIds = new Set();
  return {
    key,
    name: '',
    focus: '',
    weekday: null,
    exercises: [createEmptyExercise(exerciseIds)],
  };
}

export function createEmptyPlan() {
  const dayKeys = new Set();
  return {
    schema_version: 1,
    name: 'Mein Trainingsplan',
    days: [createEmptyDay(dayKeys)],
  };
}

export function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan));
}

export function normalizeExerciseForType(ex) {
  if (ex.type === 'time' || ex.type === 'cardio') {
    return {
      ...ex,
      target_reps: null,
      target_seconds: ex.target_seconds ?? 30,
      default_weight_kg: null,
    };
  }
  if (ex.type === 'wt') {
    return {
      ...ex,
      target_seconds: null,
      target_reps: ex.target_reps ?? '8-12',
    };
  }
  return {
    ...ex,
    target_seconds: null,
    default_weight_kg: null,
    target_reps: ex.target_reps ?? '8-12',
  };
}

export function preparePlanForSave(plan) {
  return {
    schema_version: 1,
    name: plan.name.trim(),
    days: plan.days.map((day) => ({
      key: day.key,
      name: day.name.trim(),
      focus: day.focus ?? '',
      weekday: day.weekday ?? null,
      exercises: day.exercises.map((ex) =>
        normalizeExerciseForType({
          ...ex,
          id: ex.id,
          name: ex.name.trim(),
          muscle: ex.muscle.trim(),
          cue: ex.cue ?? '',
          video_query: ex.video_query ?? '',
          sets: Number(ex.sets),
          default_weight_kg:
            ex.default_weight_kg != null && ex.default_weight_kg !== ''
              ? Number(ex.default_weight_kg)
              : null,
          target_seconds:
            ex.target_seconds != null && ex.target_seconds !== ''
              ? Number(ex.target_seconds)
              : null,
        })
      ),
    })),
  };
}

export function formatExercisePrescription(ex) {
  if (ex.type === 'time' || ex.type === 'cardio') {
    return `${ex.sets} × ${ex.target_seconds ?? 0}s`;
  }
  if (ex.type === 'wt' && ex.default_weight_kg) {
    return `${ex.sets} × ${ex.target_reps} @ ${ex.default_weight_kg} kg`;
  }
  return `${ex.sets} × ${ex.target_reps ?? '—'}`;
}

export function plansEqual(a, b) {
  return JSON.stringify(preparePlanForSave(a)) === JSON.stringify(preparePlanForSave(b));
}
