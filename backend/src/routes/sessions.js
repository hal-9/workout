import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { detectNewRecords } from 'shared/records';
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

function rpeForSession(db, sessionId) {
  return db
    .prepare('SELECT exercise_id, rpe FROM exercise_rpe WHERE session_id = ?')
    .all(sessionId);
}

// Alle früheren beendeten Sessions des Nutzers, gruppiert für die Rekord-Erkennung.
function previousSessionsForRecords(db, userId, currentSessionId) {
  const rows = db
    .prepare(
      `SELECT s.id AS session_id, sl.exercise_id, sl.set_number, sl.reps, sl.weight_kg, sl.duration_s
       FROM sessions s
       JOIN set_logs sl ON sl.session_id = s.id
       WHERE s.user_id = ? AND s.status = 'finished' AND s.id != ?
       ORDER BY s.finished_at ASC`
    )
    .all(userId, currentSessionId);

  const sessions = new Map();
  for (const row of rows) {
    if (!sessions.has(row.session_id)) {
      sessions.set(row.session_id, { session_id: row.session_id, setsByExercise: new Map() });
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

function makeDayNameResolver(db) {
  const dayNamesByPlan = new Map();
  return function dayName(planId, dayKey) {
    if (!dayNamesByPlan.has(planId)) {
      const planRow = db.prepare('SELECT json_payload FROM plans WHERE id = ?').get(planId);
      const days = planRow ? JSON.parse(planRow.json_payload).days : [];
      dayNamesByPlan.set(planId, new Map(days.map((d) => [d.key, d.name])));
    }
    return dayNamesByPlan.get(planId).get(dayKey) ?? dayKey;
  };
}

const sqlTs = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const rangeSchema = z.object({
  from: z.string().regex(sqlTs),
  to: z.string().regex(sqlTs),
});

const setKeySchema = z.object({
  exercise_id: z.string().min(1),
  set_number: z.number().int().min(1),
});

const rpeSchema = z.object({
  exercise_id: z.string().min(1),
  rpe: z.number().int().min(1).max(10).nullable(),
});

const finishSchema = z.object({
  note: z.string().max(1000).nullable().optional(),
});

const noteSchema = z.object({
  note: z.string().max(1000).nullable(),
});

const setSchema = setKeySchema
  .extend({
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

    const dayName = makeDayNameResolver(db);

    const sessions = rows.map((r) => ({
      session_id: r.id,
      day_key: r.day_key,
      day_name: dayName(r.plan_id, r.day_key),
      finished_at: r.finished_at,
      evaluation_status: r.evaluation_status ?? null,
    }));

    const activeRow = db
      .prepare(
        `SELECT id, day_key, started_at, note FROM sessions
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
          rpe: rpeForSession(db, activeRow.id),
          note: activeRow.note ?? null,
        }
      : null;

    res.json({ sessions, active });
  });

  router.get('/sessions', (req, res) => {
    const parsed = rangeSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }
    const { from, to } = parsed.data;

    const rows = db
      .prepare(
        `SELECT id, plan_id, day_key, started_at, finished_at
         FROM sessions
         WHERE user_id = ? AND status = 'finished'
           AND finished_at >= ? AND finished_at < ?
         ORDER BY finished_at ASC`
      )
      .all(req.user.id, from, to);

    const dayName = makeDayNameResolver(db);
    res.json({
      sessions: rows.map((r) => ({
        session_id: r.id,
        day_key: r.day_key,
        day_name: dayName(r.plan_id, r.day_key),
        started_at: r.started_at,
        finished_at: r.finished_at,
      })),
    });
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
        rpe: rpeForSession(db, existing.id),
        note: existing.note ?? null,
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

    res.status(201).json({ session_id: sessionId, resumed: false, set_logs: [], rpe: [], note: null });
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

  router.delete('/sessions/:id/sets', (req, res) => {
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({ error: 'not found' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'session finished' });
    }

    const result = setKeySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({ error: 'validation failed', details: result.error.issues });
    }
    const { exercise_id, set_number } = result.data;

    db.prepare(
      'DELETE FROM set_logs WHERE session_id = ? AND exercise_id = ? AND set_number = ?'
    ).run(session.id, exercise_id, set_number);

    res.json({ ok: true });
  });

  router.post('/sessions/:id/rpe', (req, res) => {
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({ error: 'not found' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'session finished' });
    }

    const result = rpeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({ error: 'validation failed', details: result.error.issues });
    }
    const { exercise_id, rpe } = result.data;

    if (rpe === null) {
      db.prepare('DELETE FROM exercise_rpe WHERE session_id = ? AND exercise_id = ?').run(
        session.id,
        exercise_id
      );
      return res.json({ ok: true, rpe: null });
    }

    db.prepare(
      `INSERT INTO exercise_rpe (session_id, exercise_id, rpe) VALUES (?, ?, ?)
       ON CONFLICT (session_id, exercise_id)
       DO UPDATE SET rpe = excluded.rpe, updated_at = datetime('now')`
    ).run(session.id, exercise_id, rpe);

    res.json({ ok: true, rpe });
  });

  // Notiz wird schon während der Session gespeichert, damit ein Reload sie nicht verliert.
  router.post('/sessions/:id/note', (req, res) => {
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({ error: 'not found' });
    }
    if (session.status !== 'active') {
      return res.status(409).json({ error: 'session finished' });
    }

    const result = noteSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({ error: 'validation failed', details: result.error.issues });
    }

    const note = result.data.note?.trim() || null;
    db.prepare('UPDATE sessions SET note = ? WHERE id = ?').run(note, session.id);
    res.json({ ok: true, note });
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

    const parsedFinish = finishSchema.safeParse(req.body ?? {});
    if (!parsedFinish.success) {
      return res.status(422).json({ error: 'validation failed', details: parsedFinish.error.issues });
    }
    const note = parsedFinish.data.note?.trim() || null;

    const logs = setLogsForSession(db, session.id);
    const plan = getActivePlan(db, req.user.id);
    // Vor dem Statuswechsel lesen, damit die aktuelle Session nicht mit sich selbst verglichen wird.
    const previousSessions = previousSessionsForRecords(db, req.user.id, session.id);

    db.transaction(() => {
      db.prepare(
        "UPDATE sessions SET status = 'finished', finished_at = datetime('now'), note = ? WHERE id = ?"
      ).run(note, session.id);

      if (logs.length > 0) {
        db.prepare(
          `INSERT INTO evaluations (session_id, model, status) VALUES (?, ?, 'pending')`
        ).run(session.id, 'gemini-2.5-flash');
      }
    })();

    if (logs.length > 0) {
      runEvaluation(db, session.id).catch(() => {});
    }

    const currentSets = groupSetsByExercise(logs);
    const summary = {
      exercises: [...currentSets.entries()].map(([exercise_id, sets]) => ({
        exercise_id,
        sets,
      })),
    };

    const new_records = plan ? detectNewRecords(plan, currentSets, previousSessions) : [];

    res.json({ session_id: session.id, summary, evaluation: logs.length > 0, new_records });
  });

  router.post('/sessions/:id/discard', (req, res) => {
    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({ error: 'not found' });
    }
    if (session.status !== 'finished') {
      return res.status(409).json({ error: 'not finished' });
    }

    db.prepare("UPDATE sessions SET status = 'discarded' WHERE id = ?").run(session.id);
    res.json({ ok: true });
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
