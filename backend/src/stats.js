import { isCooldown } from 'shared/exerciseProgress';
import { bestsForExercise, mergeBests, pickRecord, sessionMetrics, sessionTonnage } from 'shared/records';

const SESSION_WINDOW_DAYS = 84; // 12 Wochen für Heatmap und Tonnage-Trend
const MUSCLE_WINDOW_DAYS = 28;

// Übungs-Metadaten aus allen Plan-Versionen des Nutzers, damit auch ältere Sessions
// noch eine Muskelgruppe und einen Typ haben. Der aktive Plan gewinnt.
function exerciseMetaForUser(db, userId) {
  const rows = db
    .prepare('SELECT json_payload, active FROM plans WHERE user_id = ? ORDER BY active ASC, id ASC')
    .all(userId);

  const meta = new Map();
  for (const row of rows) {
    let plan;
    try {
      plan = JSON.parse(row.json_payload);
    } catch {
      continue;
    }
    for (const day of plan.days ?? []) {
      for (const ex of day.exercises ?? []) {
        if (isCooldown(ex)) continue;
        meta.set(ex.id, ex);
      }
    }
  }
  return meta;
}

function activePlan(db, userId) {
  const row = db
    .prepare('SELECT id, json_payload FROM plans WHERE user_id = ? AND active = 1')
    .get(userId);
  if (!row) return null;
  try {
    return { id: row.id, ...JSON.parse(row.json_payload) };
  } catch {
    return null;
  }
}

function logRows(db, userId, windowDays) {
  const params = [userId];
  let windowClause = '';
  if (windowDays) {
    windowClause = "AND s.finished_at >= datetime('now', ?)";
    params.push(`-${windowDays} days`);
  }
  return db
    .prepare(
      `SELECT s.id AS session_id, s.day_key, s.finished_at,
              sl.exercise_id, sl.set_number, sl.reps, sl.weight_kg, sl.duration_s
       FROM sessions s
       JOIN set_logs sl ON sl.session_id = s.id
       WHERE s.user_id = ? AND s.status = 'finished' ${windowClause}
       ORDER BY s.finished_at ASC, sl.set_number ASC`
    )
    .all(...params);
}

function groupBySession(rows) {
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
    const session = sessions.get(row.session_id);
    if (!session.setsByExercise.has(row.exercise_id)) {
      session.setsByExercise.set(row.exercise_id, []);
    }
    session.setsByExercise.get(row.exercise_id).push({
      set_number: row.set_number,
      reps: row.reps,
      weight_kg: row.weight_kg,
      duration_s: row.duration_s,
    });
  }
  return [...sessions.values()];
}

export function buildStatsForUser(db, userId) {
  const plan = activePlan(db, userId);
  if (!plan) return null;

  const meta = exerciseMetaForUser(db, userId);
  const recentSessions = groupBySession(logRows(db, userId, SESSION_WINDOW_DAYS));

  // Pro Session: Tonnage (nur Gewichtsübungen) und Satzzahl ohne Cooldown.
  const sessions = recentSessions.map((session) => {
    let tonnage = 0;
    let sets = 0;
    for (const [exerciseId, exerciseSets] of session.setsByExercise) {
      const exercise = meta.get(exerciseId);
      if (!exercise) continue;
      sets += exerciseSets.length;
      tonnage += sessionTonnage(exercise, exerciseSets);
    }
    return {
      session_id: session.session_id,
      day_key: session.day_key,
      finished_at: session.finished_at,
      tonnage_kg: Math.round(tonnage),
      sets,
    };
  });

  const muscleCutoff = new Date(Date.now() - MUSCLE_WINDOW_DAYS * 86400000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

  const byMuscle = new Map();
  for (const session of recentSessions) {
    if (session.finished_at < muscleCutoff) continue;
    for (const [exerciseId, exerciseSets] of session.setsByExercise) {
      const exercise = meta.get(exerciseId);
      if (!exercise) continue;
      const key = exercise.muscle || 'Sonstige';
      const entry = byMuscle.get(key) ?? { muscle: key, sets: 0, tonnage_kg: 0 };
      entry.sets += exerciseSets.length;
      entry.tonnage_kg += sessionTonnage(exercise, exerciseSets);
      byMuscle.set(key, entry);
    }
  }
  const volume_by_muscle = [...byMuscle.values()]
    .map((entry) => ({ ...entry, tonnage_kg: Math.round(entry.tonnage_kg) }))
    .sort((a, b) => b.sets - a.sets);

  // Bestwerte über die gesamte Historie, nur Übungen des aktiven Plans.
  const allSessions = groupBySession(logRows(db, userId, null));
  const records = [];
  for (const day of plan.days ?? []) {
    for (const exercise of day.exercises ?? []) {
      if (isCooldown(exercise)) continue;
      const bests = bestsForExercise(exercise, allSessions);
      const sessionsCount = allSessions.filter(
        (s) => s.setsByExercise.get(exercise.id)?.length
      ).length;
      if (!sessionsCount) continue;
      records.push({
        exercise_id: exercise.id,
        name: exercise.name,
        muscle: exercise.muscle,
        type: exercise.type,
        sessions_count: sessionsCount,
        ...bests,
      });
    }
  }

  return {
    plan_id: plan.id,
    plan_days: plan.days?.length ?? 0,
    window_days: SESSION_WINDOW_DAYS,
    muscle_window_days: MUSCLE_WINDOW_DAYS,
    sessions,
    volume_by_muscle,
    records,
  };
}

// UTC-Montag der Woche eines SQL-Timestamps ('YYYY-MM-DD HH:MM:SS').
// Konvention M20/M19: Wochen- und Monatsgrenzen serverseitig in UTC,
// wie finished_at selbst (Abweichung zur lokalen Woche max. Randstunden).
function utcMondayOf(sqlTs) {
  const d = new Date(sqlTs.replace(' ', 'T') + 'Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Wochen-Aggregate über die gesamte Historie für den Trainingsbaum:
 * ein Ast pro Trainingswoche, Blüten = PRs, Früchte = Max-Tests.
 * PRs werden chronologisch rekonstruiert (sie sind nirgends persistiert);
 * die erste Session einer Übung zählt nie als PR — wie detectNewRecords.
 */
export function buildTreeForUser(db, userId) {
  const meta = exerciseMetaForUser(db, userId);
  const sessions = groupBySession(logRows(db, userId, null));

  const weeks = new Map();
  const bests = new Map();
  function weekEntry(weekStart) {
    if (!weeks.has(weekStart)) {
      weeks.set(weekStart, { week_start: weekStart, workouts: 0, tonnage_kg: 0, prs: 0, max_tests: 0 });
    }
    return weeks.get(weekStart);
  }

  for (const session of sessions) {
    const entry = weekEntry(utcMondayOf(session.finished_at));
    entry.workouts += 1;
    for (const [exerciseId, sets] of session.setsByExercise) {
      const exercise = meta.get(exerciseId);
      if (!exercise) continue;
      entry.tonnage_kg += sessionTonnage(exercise, sets);
      const metrics = sessionMetrics(exercise, sets);
      const previous = bests.get(exerciseId);
      if (previous && pickRecord(exercise, metrics, previous)) entry.prs += 1;
      bests.set(exerciseId, mergeBests(previous, metrics));
    }
  }

  const tests = db.prepare('SELECT date FROM max_tests WHERE user_id = ?').all(userId);
  for (const test of tests) {
    weekEntry(utcMondayOf(`${test.date} 00:00:00`)).max_tests += 1;
  }

  return [...weeks.values()]
    .map((week) => ({ ...week, tonnage_kg: Math.round(week.tonnage_kg) }))
    .sort((a, b) => (a.week_start < b.week_start ? -1 : 1));
}
