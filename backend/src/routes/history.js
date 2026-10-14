import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { findPlanExercise, nextTargets } from 'shared/nextTargets';

export function historyRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/history', (req, res) => {
    const { day_key } = req.query;
    if (!day_key) {
      return res.status(422).json({ error: 'day_key required' });
    }

    const plan = db
      .prepare('SELECT json_payload FROM plans WHERE user_id = ? AND active = 1')
      .get(req.user.id);
    if (!plan) {
      return res.status(409).json({ error: 'no active plan' });
    }
    const parsedPlan = JSON.parse(plan.json_payload);
    const day = parsedPlan.days.find((d) => d.key === day_key);
    if (!day) {
      return res.status(422).json({ error: 'unknown day_key' });
    }

    // Zusätzliche Ids (im Workout getauschte Übungen) bekommen ebenfalls die
    // letzten Werte — sie stehen nicht im Plan, wohl aber in der Historie.
    const extraIds = String(req.query.exercise_ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 30);
    const planIds = new Set(day.exercises.map((ex) => ex.id));
    const wanted = [...day.exercises, ...extraIds.filter((id) => !planIds.has(id)).map((id) => ({ id }))];

    // Letztes beendetes Workout mit der Übung. Leichte Versionen zählen nicht:
    // ihre reduzierten Werte sollen nicht zur normalen Vorgabe werden.
    const lastSessionStmt = db.prepare(
      `SELECT sessions.id, sessions.plan_id FROM sessions
       JOIN set_logs ON set_logs.session_id = sessions.id
       WHERE sessions.user_id = ? AND sessions.status = 'finished'
         AND COALESCE(json_extract(sessions.adaptations_json, '$.light'), 0) = 0
         AND set_logs.exercise_id = ?
       ORDER BY sessions.finished_at DESC, sessions.id DESC
       LIMIT 1`
    );
    const setsStmt = db.prepare(
      `SELECT set_number, reps, weight_kg, duration_s, band_count, band_kg FROM set_logs
       WHERE session_id = ? AND exercise_id = ? ORDER BY set_number`
    );
    const planStmt = db.prepare('SELECT json_payload FROM plans WHERE id = ? AND user_id = ?');
    const planCache = new Map();
    const planById = (id) => {
      if (!planCache.has(id)) {
        const row = planStmt.get(id, req.user.id);
        planCache.set(id, row ? JSON.parse(row.json_payload) : null);
      }
      return planCache.get(id);
    };

    // prefill = was zuletzt geloggt wurde („Letztes Mal"); targets = Vorgabe
    // fürs nächste Workout (gleich prefill, außer der Plan wurde seitdem geändert).
    const prefill = {};
    const targets = {};
    for (const ex of wanted) {
      const lastSession = lastSessionStmt.get(req.user.id, ex.id);
      if (!lastSession) continue;
      prefill[ex.id] = setsStmt.all(lastSession.id, ex.id);
      const now = findPlanExercise(parsedPlan, ex.id);
      const then = findPlanExercise(planById(lastSession.plan_id), ex.id);
      targets[ex.id] = nextTargets(prefill[ex.id], now, then);
    }

    const recentSessionRows = db
      .prepare(
        `SELECT id, started_at FROM sessions
         WHERE user_id = ? AND day_key = ? AND status = 'finished'
         ORDER BY finished_at DESC LIMIT 5`
      )
      .all(req.user.id, day_key);

    const recent_sessions = recentSessionRows.map((s) => ({
      session_id: s.id,
      started_at: s.started_at,
      day_key,
      sets: db
        .prepare(
          `SELECT exercise_id, set_number, reps, weight_kg, duration_s, band_count, band_kg FROM set_logs
           WHERE session_id = ? ORDER BY exercise_id, set_number`
        )
        .all(s.id),
    }));

    res.json({ prefill, targets, recent_sessions });
  });

  return router;
}
