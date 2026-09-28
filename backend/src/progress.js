import { buildExerciseProgressList, groupLogsBySession } from 'shared/exerciseProgress';
import { bodyweightAt } from 'shared/bandAssist';

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
