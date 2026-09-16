// Alle beendeten Sessions eines Nutzers mit Sätzen pro Übung, älteste zuerst —
// das Format, das shared/records (bestsForExercise, detectNewRecords) erwartet.
export function previousSessionsForRecords(db, userId, currentSessionId) {
  const rows = db
    .prepare(
      `SELECT s.id AS session_id, s.day_key, s.finished_at,
              sl.exercise_id, sl.set_number, sl.reps, sl.weight_kg, sl.duration_s
       FROM sessions s
       JOIN set_logs sl ON sl.session_id = s.id
       WHERE s.user_id = ? AND s.status = 'finished' AND s.id != ?
       ORDER BY s.finished_at ASC`
    )
    .all(userId, currentSessionId);

  const sessions = new Map();
  for (const row of rows) {
    if (!sessions.has(row.session_id)) {
      sessions.set(row.session_id, {
        session_id: row.session_id,
        day_key: row.day_key,
        finished_at: row.finished_at,
        setsByExercise: new Map(),
      });
    }
    const bucket = sessions.get(row.session_id).setsByExercise;
    if (!bucket.has(row.exercise_id)) bucket.set(row.exercise_id, []);
    bucket.get(row.exercise_id).push({
      set_number: row.set_number,
      reps: row.reps,
      weight_kg: row.weight_kg,
      duration_s: row.duration_s,
    });
  }

  return [...sessions.values()];
}
