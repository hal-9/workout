import { Router } from 'express';
import { requireAuth } from '../auth.js';

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

    const prefill = {};
    for (const ex of day.exercises) {
      const lastSession = db
        .prepare(
          `SELECT sessions.id FROM sessions
           JOIN set_logs ON set_logs.session_id = sessions.id
           WHERE sessions.user_id = ? AND sessions.status = 'finished'
             AND set_logs.exercise_id = ?
           ORDER BY sessions.finished_at DESC
           LIMIT 1`
        )
        .get(req.user.id, ex.id);

      if (lastSession) {
        prefill[ex.id] = db
          .prepare(
            `SELECT set_number, reps, weight_kg, duration_s FROM set_logs
             WHERE session_id = ? AND exercise_id = ? ORDER BY set_number`
          )
          .all(lastSession.id, ex.id);
      }
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
          `SELECT exercise_id, set_number, reps, weight_kg, duration_s FROM set_logs
           WHERE session_id = ? ORDER BY exercise_id, set_number`
        )
        .all(s.id),
    }));

    res.json({ prefill, recent_sessions });
  });

  return router;
}
