import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { runEvaluation } from '../evaluation.js';

function getActivePlan(db, userId) {
  const row = db
    .prepare('SELECT id, json_payload FROM plans WHERE user_id = ? AND active = 1')
    .get(userId);
  if (!row) return null;
  return { id: row.id, ...JSON.parse(row.json_payload) };
}

function setLogsForSession(db, sessionId) {
  return db
    .prepare(
      'SELECT exercise_id, set_number, reps, weight_kg, duration_s FROM set_logs WHERE session_id = ? ORDER BY set_number'
    )
    .all(sessionId);
}

const setSchema = z
  .object({
    exercise_id: z.string().min(1),
    set_number: z.number().int().min(1),
    reps: z.number().int().nullable(),
    weight_kg: z.number().nullable(),
    duration_s: z.number().int().nullable(),
  })
  .refine((data) => (data.reps !== null) !== (data.duration_s !== null), {
    message: 'exactly one of reps/duration_s must be set',
  });

export function sessionsRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.post('/sessions', (req, res) => {
    const { day_key } = req.body || {};

    const plan = getActivePlan(db, req.user.id);
    if (!plan) {
      return res.status(409).json({ error: 'no active plan' });
    }
    if (!plan.days.some((d) => d.key === day_key)) {
      return res.status(422).json({ error: 'unknown day_key' });
    }

    const existing = db
      .prepare(
        `SELECT * FROM sessions
         WHERE user_id = ? AND day_key = ? AND status = 'active'
           AND started_at > datetime('now', '-1 day')`
      )
      .get(req.user.id, day_key);

    if (existing) {
      return res.json({
        session_id: existing.id,
        resumed: true,
        set_logs: setLogsForSession(db, existing.id),
      });
    }

    const sessionId = db.transaction(() => {
      db.prepare(
        `UPDATE sessions SET status = 'discarded' WHERE user_id = ? AND status = 'active'`
      ).run(req.user.id);

      const info = db
        .prepare(
          'INSERT INTO sessions (user_id, plan_id, day_key) VALUES (?, ?, ?)'
        )
        .run(req.user.id, plan.id, day_key);
      return info.lastInsertRowid;
    })();

    res.status(201).json({ session_id: sessionId, resumed: false, set_logs: [] });
  });

  router.post('/sessions/:id/sets', (req, res) => {
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({ error: 'not found' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'session finished' });
    }

    const result = setSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({ error: 'validation failed', details: result.error.issues });
    }
    const { exercise_id, set_number, reps, weight_kg, duration_s } = result.data;

    db.prepare(
      `INSERT INTO set_logs (session_id, exercise_id, set_number, reps, weight_kg, duration_s)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (session_id, exercise_id, set_number)
       DO UPDATE SET reps = excluded.reps, weight_kg = excluded.weight_kg,
         duration_s = excluded.duration_s, updated_at = datetime('now')`
    ).run(session.id, exercise_id, set_number, reps, weight_kg, duration_s);

    res.json({ ok: true });
  });

  router.post('/sessions/:id/finish', (req, res) => {
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({ error: 'not found' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'session finished' });
    }

    const logs = setLogsForSession(db, session.id);

    db.transaction(() => {
      db.prepare(
        "UPDATE sessions SET status = 'finished', finished_at = datetime('now') WHERE id = ?"
      ).run(session.id);

      if (logs.length > 0) {
        db.prepare(
          `INSERT INTO evaluations (session_id, model, status) VALUES (?, ?, 'pending')`
        ).run(session.id, 'gemini-2.5-flash');
      }
    })();

    if (logs.length > 0) {
      runEvaluation(db, session.id).catch(() => {});
    }

    const byExercise = new Map();
    for (const log of logs) {
      if (!byExercise.has(log.exercise_id)) byExercise.set(log.exercise_id, []);
      byExercise.get(log.exercise_id).push(log);
    }
    const summary = {
      exercises: [...byExercise.entries()].map(([exercise_id, sets]) => ({
        exercise_id,
        sets,
      })),
    };

    res.json({ session_id: session.id, summary, evaluation: logs.length > 0 });
  });

  router.post('/sessions/:id/evaluate', (req, res) => {
    const evaluation = db
      .prepare(
        `SELECT evaluations.* FROM evaluations
         JOIN sessions ON sessions.id = evaluations.session_id
         WHERE evaluations.session_id = ? AND sessions.user_id = ?`
      )
      .get(req.params.id, req.user.id);

    if (!evaluation) {
      return res.status(404).json({ error: 'not found' });
    }
    if (evaluation.status !== 'failed') {
      return res.status(409).json({ error: evaluation.status });
    }

    db.prepare(
      "UPDATE evaluations SET status = 'pending', error = NULL, updated_at = datetime('now') WHERE session_id = ?"
    ).run(req.params.id);
    runEvaluation(db, Number(req.params.id)).catch(() => {});

    res.status(202).json({ status: 'pending' });
  });

  router.get('/sessions/:id/evaluation', (req, res) => {
    const evaluation = db
      .prepare(
        `SELECT evaluations.* FROM evaluations
         JOIN sessions ON sessions.id = evaluations.session_id
         WHERE evaluations.session_id = ? AND sessions.user_id = ?`
      )
      .get(req.params.id, req.user.id);

    if (!evaluation) {
      return res.status(404).json({ error: 'not found' });
    }
    if (evaluation.status === 'ok') {
      return res.json({ status: 'ok', summary_md: evaluation.summary_md });
    }
    if (evaluation.status === 'failed') {
      return res.json({ status: 'failed', error: evaluation.error });
    }
    res.json({ status: 'pending' });
  });

  return router;
}
