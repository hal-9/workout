import { applyProposals, deloadWeek, evaluatePlan } from 'shared/progression';

const HISTORY_LIMIT = 8; // reicht für after_success bis 8

function activePlanRow(db, userId) {
  return db
    .prepare('SELECT id, name, created_at, json_payload FROM plans WHERE user_id = ? AND active = 1')
    .get(userId);
}

// Letzte beendete Sessions mit Sätzen, älteste zuerst.
function recentSessions(db, userId, planId) {
  const rows = db
    .prepare(
      `SELECT s.id AS session_id, s.finished_at,
              sl.exercise_id, sl.set_number, sl.reps, sl.weight_kg, sl.duration_s,
              sl.set_type, sl.superset_group
       FROM sessions s
       JOIN set_logs sl ON sl.session_id = s.id
       WHERE s.user_id = ? AND s.plan_id = ? AND s.status = 'finished'
       ORDER BY s.finished_at ASC, sl.set_number ASC`
    )
    .all(userId, planId);

  const sessions = new Map();
  for (const row of rows) {
    if (!sessions.has(row.session_id)) {
      sessions.set(row.session_id, {
        session_id: row.session_id,
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
      set_type: row.set_type ?? 'working',
      superset_group: row.superset_group,
    });
  }

  return [...sessions.values()].slice(-HISTORY_LIMIT);
}

export function buildProposalsForUser(db, userId) {
  const row = activePlanRow(db, userId);
  if (!row) return null;

  let plan;
  try {
    plan = JSON.parse(row.json_payload);
  } catch {
    return null;
  }

  const sessions = recentSessions(db, userId, row.id);
  const planStartMs = Date.parse(`${row.created_at.replace(' ', 'T')}Z`);

  return {
    plan_id: row.id,
    plan_name: plan.name,
    proposals: evaluatePlan(plan, sessions),
    deload: deloadWeek(plan, Number.isNaN(planStartMs) ? null : planStartMs, Date.now()),
  };
}

/**
 * Wendet die Vorschläge für die genannten Übungen an und legt eine neue
 * Plan-Version an. Die Werte werden serverseitig neu berechnet — der Client
 * schickt nur, welche Übungen er übernehmen will.
 */
export function applyProposalsForUser(db, userId, exerciseIds) {
  const row = activePlanRow(db, userId);
  if (!row) return { error: 'no active plan' };

  const plan = JSON.parse(row.json_payload);
  const sessions = recentSessions(db, userId, row.id);
  const all = evaluatePlan(plan, sessions);

  const wanted = new Set(exerciseIds);
  const applied = all.filter((proposal) => wanted.has(proposal.exercise_id));
  if (!applied.length) return { error: 'no matching proposals' };

  const nextPlan = applyProposals(plan, applied);

  const planId = db.transaction(() => {
    db.prepare('UPDATE plans SET active = 0 WHERE user_id = ?').run(userId);
    const info = db
      .prepare(
        'INSERT INTO plans (user_id, name, schema_version, json_payload, active) VALUES (?, ?, ?, ?, 1)'
      )
      .run(userId, nextPlan.name, nextPlan.schema_version, JSON.stringify(nextPlan));
    return info.lastInsertRowid;
  })();

  return { plan_id: planId, applied };
}
