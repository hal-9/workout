import { isCooldown } from 'shared/exerciseProgress';
import { exerciseZones, ZONE_LABELS } from 'shared/muscles';
import { mergeBests, pickRecord, sessionMetrics, sessionTonnage } from 'shared/records';

// Monats-Rückblick (Wrapped): reine Aggregation über finished-Sessions.
// Monatsgrenzen in UTC — dieselbe Konvention wie finished_at und der Baum.

export function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

export function previousMonthKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return monthKey(d);
}

export function isMonthKey(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01 00:00:00`;
  const next = new Date(Date.UTC(y, m, 1)); // m ist 1-basiert → nächster Monat
  const to = `${next.toISOString().slice(0, 10)} 00:00:00`;
  return { from, to };
}

// Übungs-Metadaten aus allen Plan-Versionen (aktiver Plan gewinnt) — wie stats.js.
function exerciseMetaForUser(db, userId) {
  const rows = db
    .prepare('SELECT json_payload FROM plans WHERE user_id = ? ORDER BY active ASC, id ASC')
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

function sessionsWithSets(db, userId, from, to) {
  const params = [userId];
  let clause = '';
  if (from) {
    clause = 'AND s.finished_at >= ? AND s.finished_at < ?';
    params.push(from, to);
  }
  const rows = db
    .prepare(
      `SELECT s.id AS session_id, s.finished_at,
              sl.exercise_id, sl.set_number, sl.reps, sl.weight_kg, sl.duration_s
       FROM sessions s
       JOIN set_logs sl ON sl.session_id = s.id
       WHERE s.user_id = ? AND s.status = 'finished' ${clause}
       ORDER BY s.finished_at ASC, sl.set_number ASC`
    )
    .all(...params);

  const sessions = new Map();
  for (const row of rows) {
    if (!sessions.has(row.session_id)) {
      sessions.set(row.session_id, { finished_at: row.finished_at, setsByExercise: new Map() });
    }
    const session = sessions.get(row.session_id);
    if (!session.setsByExercise.has(row.exercise_id)) session.setsByExercise.set(row.exercise_id, []);
    session.setsByExercise.get(row.exercise_id).push({
      set_number: row.set_number,
      reps: row.reps,
      weight_kg: row.weight_kg,
      duration_s: row.duration_s,
    });
  }
  return [...sessions.values()];
}

function utcMondayOf(sqlTs) {
  const d = new Date(sqlTs.replace(' ', 'T') + 'Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function buildWrappedForUser(db, userId, month) {
  const meta = exerciseMetaForUser(db, userId);
  const { from, to } = monthRange(month);
  const all = sessionsWithSets(db, userId, null, null);

  let tonnage = 0;
  let tonnagePrev = 0;
  let workouts = 0;
  const weekSet = new Set();
  const zoneSets = new Map();
  const bests = new Map();
  let topPr = null;

  const prevMonth = previousMonthKey(new Date(`${month}-15T00:00:00Z`));
  const prevRange = monthRange(prevMonth);

  // Ein chronologischer Durchlauf: Bestwerte wachsen mit, PRs zählen nur im Zielmonat.
  for (const session of all) {
    const inMonth = session.finished_at >= from && session.finished_at < to;
    const inPrev = session.finished_at >= prevRange.from && session.finished_at < prevRange.to;
    if (inMonth) {
      workouts += 1;
      weekSet.add(utcMondayOf(session.finished_at));
    }
    for (const [exerciseId, sets] of session.setsByExercise) {
      const exercise = meta.get(exerciseId);
      if (!exercise) continue;
      const exerciseTonnage = sessionTonnage(exercise, sets);
      if (inMonth) tonnage += exerciseTonnage;
      if (inPrev) tonnagePrev += exerciseTonnage;

      const metrics = sessionMetrics(exercise, sets);
      const previous = bests.get(exerciseId);
      if (inMonth && previous) {
        const record = pickRecord(exercise, metrics, previous);
        if (record && record.previous > 0) {
          const gain = (record.value - record.previous) / record.previous;
          if (!topPr || gain > topPr.gain) {
            topPr = { name: exercise.name, kind: record.kind, unit: record.unit, value: record.value, previous: record.previous, gain };
          }
        }
      }
      bests.set(exerciseId, mergeBests(previous, metrics));

      if (inMonth) {
        for (const zone of exerciseZones(exercise).primary) {
          zoneSets.set(zone, (zoneSets.get(zone) ?? 0) + sets.length);
        }
      }
    }
  }

  let topZone = null;
  for (const [zone, sets] of zoneSets) {
    if (!topZone || sets > topZone.sets) topZone = { zone, label: ZONE_LABELS[zone] ?? zone, sets };
  }

  return {
    month,
    workouts,
    weeks_grown: weekSet.size,
    tonnage_kg: Math.round(tonnage),
    tonnage_prev_kg: Math.round(tonnagePrev),
    top_pr: topPr ? { name: topPr.name, kind: topPr.kind, unit: topPr.unit, value: topPr.value, previous: topPr.previous } : null,
    top_zone: topZone,
  };
}

export function wrappedStatus(db, userId, now = new Date()) {
  const month = previousMonthKey(now);
  const { from, to } = monthRange(month);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM sessions
       WHERE user_id = ? AND status = 'finished' AND finished_at >= ? AND finished_at < ?`
    )
    .get(userId, from, to);
  const seen = db
    .prepare('SELECT 1 FROM wrapped_seen WHERE user_id = ? AND month = ?')
    .get(userId, month);
  return { month, available: row.n > 0, seen: Boolean(seen) };
}

export function markWrappedSeen(db, userId, month) {
  db.prepare(
    'INSERT INTO wrapped_seen (user_id, month) VALUES (?, ?) ON CONFLICT (user_id, month) DO NOTHING'
  ).run(userId, month);
}
