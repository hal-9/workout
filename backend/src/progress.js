import { buildExerciseProgressList, groupLogsBySession } from 'shared/exerciseProgress';
import { bodyweightAt } from 'shared/bandAssist';
import { compareExposures, pickImprovementFacts } from 'shared/progressAnswers';

export function buildProgressForUser(db, userId) {
  const planRow = db
    .prepare('SELECT id, name, created_at, json_payload FROM plans WHERE user_id = ? AND active = 1')
    .get(userId);

  if (!planRow) return null;

  const plan = JSON.parse(planRow.json_payload);
  const rows = db
    .prepare(
      `SELECT s.id AS session_id, s.finished_at, sl.exercise_id,
              sl.set_number, sl.reps, sl.weight_kg, sl.duration_s, sl.band_count, sl.band_kg
       FROM sessions s
       JOIN set_logs sl ON sl.session_id = s.id
       WHERE s.user_id = ? AND s.plan_id = ? AND s.status = 'finished'
       ORDER BY s.finished_at ASC`
    )
    .all(userId, planRow.id);

  const sessionLogs = groupLogsBySession(rows);
  // Körpergewicht für die effektive Last bei Band-Übungen.
  const bodyweights = db
    .prepare("SELECT date, value FROM max_tests WHERE user_id = ? AND kind = 'bodyweight' ORDER BY date ASC")
    .all(userId);
  const { highlights, exercises } = buildExerciseProgressList(plan, sessionLogs, {
    bodyweightFor: (session) => bodyweightAt(bodyweights, session.finished_at),
  });

  return {
    plan_id: planRow.id,
    plan_name: plan.name,
    plan_since: planRow.created_at,
    highlights,
    exercises,
  };
}

const LOOKBACK_DAYS = 56; // Vergleich nur aus den letzten acht Wochen

/**
 * „Werde ich besser?" für den Fortschritt-Tab: pro Übung des aktiven Plans
 * die letzten zwei beendeten Workouts (auch aus älteren Plan-Versionen,
 * ohne leichte Versionen) Satz für Satz vergleichen.
 */
export function buildProgressSummaryForUser(db, userId) {
  const planRow = db.prepare('SELECT json_payload FROM plans WHERE user_id = ? AND active = 1').get(userId);
  if (!planRow) return null;
  const plan = JSON.parse(planRow.json_payload);

  const lastTwo = db.prepare(
    `SELECT s.id, s.finished_at FROM sessions s
     WHERE s.user_id = ? AND s.status = 'finished'
       AND COALESCE(json_extract(s.adaptations_json, '$.light'), 0) = 0
       AND s.finished_at >= datetime('now', ?)
       AND EXISTS (SELECT 1 FROM set_logs sl WHERE sl.session_id = s.id AND sl.exercise_id = ?)
     ORDER BY s.finished_at DESC, s.id DESC
     LIMIT 2`
  );
  const setsStmt = db.prepare(
    `SELECT set_number, reps, weight_kg, duration_s, band_count FROM set_logs
     WHERE session_id = ? AND exercise_id = ? ORDER BY set_number`
  );

  const seen = new Set();
  const comparisons = [];
  for (const exercise of plan.days.flatMap((d) => d.exercises ?? [])) {
    if (seen.has(exercise.id) || exercise.phase === 'cooldown') continue;
    seen.add(exercise.id);
    const [last, prev] = lastTwo.all(userId, `-${LOOKBACK_DAYS} days`, exercise.id);
    if (!prev) continue;
    const result = compareExposures(exercise, setsStmt.all(prev.id, exercise.id), setsStmt.all(last.id, exercise.id));
    if (result) comparisons.push({ ...result, exercise_id: exercise.id, dates: [prev.finished_at, last.finished_at] });
  }

  return {
    improvement: {
      state: comparisons.length ? 'compared' : 'no_comparison',
      facts: pickImprovementFacts(comparisons),
    },
  };
}
