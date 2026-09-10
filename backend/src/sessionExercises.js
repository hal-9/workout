// Übungen einer Session = Übungen des Plan-Tags + Übungen, die im Workout
// getauscht wurden (`sessions.adaptations_json.replaced`). Getauschte Übungen
// loggen unter ihrer eigenen Id, deshalb kennt der Plan sie nicht — Name,
// Typ und Zonen müssen aus der Session selbst kommen.

export function parseAdaptations(json) {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function replacedExercises(adaptations) {
  return (adaptations?.replaced ?? []).map((entry) => entry?.exercise).filter(Boolean);
}

/** Map exercise_id → Übung für eine Session. Plan-Übungen gewinnen bei gleicher Id. */
export function sessionExerciseMeta(day, adaptations) {
  const meta = new Map((day?.exercises ?? []).map((exercise) => [exercise.id, exercise]));
  for (const exercise of replacedExercises(adaptations)) {
    if (!meta.has(exercise.id)) meta.set(exercise.id, exercise);
  }
  return meta;
}

/** Alle getauschten Übungen eines Nutzers über seine Sessions (für Statistik/Baum). */
export function replacedExercisesForUser(db, userId) {
  const rows = db
    .prepare(
      `SELECT adaptations_json FROM sessions
       WHERE user_id = ? AND adaptations_json IS NOT NULL AND status != 'discarded'`
    )
    .all(userId);
  const out = new Map();
  for (const row of rows) {
    for (const exercise of replacedExercises(parseAdaptations(row.adaptations_json))) {
      if (!out.has(exercise.id)) out.set(exercise.id, exercise);
    }
  }
  return out;
}
