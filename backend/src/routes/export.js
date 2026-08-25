import { Router } from 'express';
import { requireAuth } from '../auth.js';

function getActivePlan(db, userId) {
  const row = db
    .prepare('SELECT id, name, schema_version, json_payload, created_at FROM plans WHERE user_id = ? AND active = 1')
    .get(userId);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    schema_version: row.schema_version,
    created_at: row.created_at,
    ...JSON.parse(row.json_payload),
  };
}

export function exportRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/export', (req, res) => {
    const userId = req.user.id;
    const plan = getActivePlan(db, userId);

    const sessions = db
      .prepare(
        `SELECT s.id, s.day_key, s.started_at, s.finished_at, s.note, s.status
         FROM sessions s WHERE s.user_id = ? AND s.status = 'finished'
         ORDER BY s.finished_at ASC`
      )
      .all(userId);

    const setLogs = db
      .prepare(
        `SELECT sl.session_id, sl.exercise_id, sl.set_number, sl.reps, sl.weight_kg,
                sl.duration_s, sl.set_type, sl.superset_group
         FROM set_logs sl
         JOIN sessions s ON s.id = sl.session_id
         WHERE s.user_id = ? AND s.status = 'finished'`
      )
      .all(userId);

    const maxTests = db
      .prepare('SELECT kind, value, date FROM max_tests WHERE user_id = ? ORDER BY date ASC')
      .all(userId);

    const rpeRows = db
      .prepare(
        `SELECT er.session_id, er.exercise_id, er.rpe, er.rir
         FROM exercise_rpe er
         JOIN sessions s ON s.id = er.session_id
         WHERE s.user_id = ? AND s.status = 'finished'`
      )
      .all(userId);

    res.json({
      exported_at: new Date().toISOString(),
      plan,
      sessions,
      set_logs: setLogs,
      exercise_rpe: rpeRows,
      max_tests: maxTests,
    });
  });

  router.get('/export.csv', (req, res) => {
    const userId = req.user.id;
    const rows = db
      .prepare(
        `SELECT s.finished_at, s.day_key, sl.exercise_id, sl.set_number,
                sl.reps, sl.weight_kg, sl.duration_s, sl.set_type
         FROM set_logs sl
         JOIN sessions s ON s.id = sl.session_id
         WHERE s.user_id = ? AND s.status = 'finished'
         ORDER BY s.finished_at, sl.exercise_id, sl.set_number`
      )
      .all(userId);

    const header = 'finished_at,day_key,exercise_id,set_number,reps,weight_kg,duration_s,set_type';
    const lines = rows.map((r) =>
      [r.finished_at, r.day_key, r.exercise_id, r.set_number, r.reps ?? '', r.weight_kg ?? '', r.duration_s ?? '', r.set_type ?? 'working'].join(',')
    );
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lilief-export.csv"');
    res.send(csv);
  });

  return router;
}
