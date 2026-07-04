import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';
const MAX_OUTPUT_TOKENS = 600;
const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = `Du bist ein sachlicher Krafttrainings-Coach. Du bekommst Trainingsdaten als JSON:
die aktuelle Session, die letzten Sessions desselben Trainingstags und den
Körpergewichts-Verlauf.

Aufgabe:
1. Vergleiche die aktuelle Session pro Übung mit den vorherigen Sessions
   (Wiederholungen, Gewicht, Volumen). Benenne Fortschritt und Rückschritt konkret.
2. Beziehe den Körpergewichts-Trend ein, wo er relevant ist
   (z.B. bei Körpergewichtsübungen).
3. Gib 2–3 konkrete, umsetzbare Empfehlungen für die nächste Session.

Antworte knapp auf Deutsch in Markdown. Struktur: kurze Gesamteinschätzung,
dann pro Übung eine Zeile, dann "**Empfehlungen:**" als Liste.
Keine Einleitungsfloskeln. Maximal ~250 Wörter.`;

function formatExerciseSets(db, sessionId, exerciseMeta) {
  const logs = db
    .prepare(
      `SELECT exercise_id, set_number, reps, weight_kg, duration_s FROM set_logs
       WHERE session_id = ? ORDER BY exercise_id, set_number`
    )
    .all(sessionId);

  const byExercise = new Map();
  for (const log of logs) {
    if (!byExercise.has(log.exercise_id)) byExercise.set(log.exercise_id, []);
    const set = { set: log.set_number };
    if (log.reps !== null) set.reps = log.reps;
    if (log.weight_kg !== null) set.weight_kg = log.weight_kg;
    if (log.duration_s !== null) set.duration_s = log.duration_s;
    byExercise.get(log.exercise_id).push(set);
  }

  return [...byExercise.entries()].map(([exerciseId, sets]) => {
    const meta = exerciseMeta.get(exerciseId);
    return { id: exerciseId, name: meta?.name ?? exerciseId, type: meta?.type ?? 'bw', sets };
  });
}

export function buildAggregate(db, session, plan) {
  const day = plan.days.find((d) => d.key === session.day_key);
  const exerciseMeta = new Map(day.exercises.map((e) => [e.id, e]));

  const previousSessions = db
    .prepare(
      `SELECT id, started_at FROM sessions
       WHERE user_id = ? AND day_key = ? AND status = 'finished' AND id != ?
       ORDER BY finished_at DESC LIMIT 5`
    )
    .all(session.user_id, session.day_key, session.id);

  const bodyweightLog = db
    .prepare(
      `SELECT date, value FROM max_tests WHERE user_id = ? AND kind = 'bodyweight'
       ORDER BY date DESC LIMIT 5`
    )
    .all(session.user_id);

  return {
    day: day.name,
    current_session: {
      date: session.started_at.slice(0, 10),
      exercises: formatExerciseSets(db, session.id, exerciseMeta),
    },
    previous_sessions: previousSessions.map((s) => ({
      date: s.started_at.slice(0, 10),
      exercises: formatExerciseSets(db, s.id, exerciseMeta),
    })),
    bodyweight_log: bodyweightLog.reverse().map((b) => ({ date: b.date, kg: b.value })),
  };
}

export async function runEvaluation(db, sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  const planRow = db.prepare('SELECT json_payload FROM plans WHERE id = ?').get(session.plan_id);
  const plan = JSON.parse(planRow.json_payload);
  const aggregate = buildAggregate(db, session, plan);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    db.prepare(
      "UPDATE evaluations SET status = 'failed', error = ?, updated_at = datetime('now') WHERE session_id = ?"
    ).run('GEMINI_API_KEY not configured', sessionId);
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS));
    const response = await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: JSON.stringify(aggregate),
        config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      timeout,
    ]);

    db.prepare(
      "UPDATE evaluations SET status = 'ok', summary_md = ?, updated_at = datetime('now') WHERE session_id = ?"
    ).run(response.text, sessionId);
  } catch (err) {
    db.prepare(
      "UPDATE evaluations SET status = 'failed', error = ?, updated_at = datetime('now') WHERE session_id = ?"
    ).run(err.message || 'unknown error', sessionId);
  }
}
