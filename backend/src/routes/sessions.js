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

function groupSetsByExercise(logs) {
  const byExercise = new Map();
  for (const log of logs) {
    if (!byExercise.has(log.exercise_id)) byExercise.set(log.exercise_id, []);
    byExercise.get(log.exercise_id).push(log);
  }
  return byExercise;
}

export function sessionsRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/sessions/recent', (req, res) => {
    let limit = Number(req.query.limit) || 20;
    limit = Math.min(Math.max(Math.trunc(limit), 1), 50);

    const rows = db
      .prepare(
        `SELECT sessions.id, sessions.plan_id, sessions.day_key, sessions.finished_at,
                evaluations.status AS evaluation_status
         FROM sessions
         LEFT JOIN evaluations ON evaluations.session_id = sessions.id
         WHERE sessions.user_id = ? AND sessions.status = 'finished'
         ORDER BY sessions.finished_at DESC
         LIMIT ?`
      )
      .all(req.user.id, limit);

    const dayNamesByPlan = new Map();
    function dayName(planId, dayKey) {
      if (!dayNamesByPlan.has(planId)) {
        const planRow = db.prepare('SELECT json_payload FROM plans WHERE id = ?').get(planId);
        const days = planRow ? JSON.parse(planRow.json_payload).days : [];
        dayNamesByPlan.set(planId, new Map(days.map((d) => [d.key, d.name])));
      }
      return dayNamesByPlan.get(planId).get(dayKey) ?? dayKey;
    }

    const sessions = rows.map((r) => ({
      session_id: r.id,
      day_key: r.day_key,
      day_name: dayName(r.plan_id, r.day_key),
      finished_at: r.finished_at,
      evaluation_status: r.evaluation_status ?? null,
    }));

    const activeRow = db
      .prepare(
        `SELECT id, day_key, started_at FROM sessions
         WHERE user_id = ? AND status = 'active'
         ORDER BY started_at DESC LIMIT 1`
      )
      .get(req.user.id);

    const active = activeRow
      ? {
          session_id: activeRow.id,
          day_key: activeRow.day_key,
          started_at: activeRow.started_at,
          set_logs: setLogsForSession(db, activeRow.id),
        }
      : null;

    res.json({ sessions, active });
  });

  router.get('/sessions/:id/summary', (req, res) => {
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({ error: 'not found' });
    }

    const planRow = db.prepare('SELECT json_payload FROM plans WHERE id = ?').get(session.plan_id);
    const days = planRow ? JSON.parse(planRow.json_payload).days : [];
    const day = days.find((d) => d.key === session.day_key);
    const exerciseNames = new Map((day?.exercises ?? []).map((e) => [e.id, e.name]));

    const logs = setLogsForSession(db, session.id);
    const summary = {
      exercises: [...groupSetsByExercise(logs).entries()].map(([exercise_id, sets]) => ({
        exercise_id,
        name: exerciseNames.get(exercise_id) ?? exercise_id,
        sets,
      })),
    };

    const evaluation = db.prepare('SELECT 1 FROM evaluations WHERE session_id = ?').get(session.id);

    res.json({
      session_id: session.id,
      day_key: session.day_key,
      day_name: day?.name ?? session.day_key,
      finished_at: session.finished_at,
      evaluation: Boolean(evaluation),
      summary,
    });
  });

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

    const summary = {
      exercises: [...groupSetsByExercise(logs).entries()].map(([exercise_id, sets]) => ({
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
