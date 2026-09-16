import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { formatDuration } from 'shared/duration';
import { bestsForExercise, detectNewRecords, sessionMetrics } from 'shared/records';
import { parseAdaptations, sessionExerciseMeta } from './sessionExercises.js';
import { previousSessionsForRecords } from './sessionHistory.js';

const MODEL = 'gemini-2.5-flash';
// Gemini 2.5 denkt standardmäßig mit — Denk-Tokens zählen gegen maxOutputTokens.
// Ohne thinkingBudget: 0 war der sichtbare Text bei 600 Tokens regelmäßig abgeschnitten.
// Die Vergleiche sind vorgerechnet (vs_last, best_before, new_record), Denken bringt wenig.
const MAX_OUTPUT_TOKENS = 2000;
const TIMEOUT_MS = 30000;

export const COACH_FIELDS = ['weight_kg', 'reps', 'duration_s'];
export const TRENDS = ['up', 'flat', 'down', 'new'];

const SYSTEM_PROMPT = `Du bist ein persönlicher Krafttrainings-Coach. Du bekommst die gerade beendete Session als JSON.
Die Vergleiche sind bereits berechnet — rechne nicht selbst nach, nutze diese Felder:
- metrics: Kennzahlen heute (max_weight, max_reps, max_duration, max_e1rm, volume = Tonnage in kg)
- vs_last: Differenz zur letzten Session mit dieser Übung (positiv = mehr), inkl. deren Datum
- best_before: Bestwerte vor heute; new_record: heute aufgestellter Rekord (kind, value, previous)
- rpe: subjektive Anstrengung 1–10 pro Übung (optional); readiness: energy/soreness 1–5 vor dem Training (optional)
- session_number_for_day: die wievielte Session dieses Trainingstags; sessions_last_7_days/28_days: Rhythmus
- light_version: Nutzer hat bewusst die leichte Variante trainiert (−1 Satz, −10 % Gewicht)
Dauern haben duration_display (z.B. "25 Min") — nutze diese Schreibweise, nie Sekunden.

Antworte ausschließlich als JSON nach dem Schema, auf Deutsch, per Du. Kurze Sätze, Zahlen statt Adjektive, keine Floskeln.

headline: Ein Satz, höchstens 60 Zeichen, die wichtigste Aussage dieses Trainings — konkret mit Übung oder Zahl,
  nie generisch. Gut: "Rudern: neuer Bestwert bei 42,5 kg", "Volumen gehalten trotz Energie 2/5". Schlecht: "Starke Session!".
verdict: 2–3 Sätze Gesamteinschätzung. Beziehe rpe, readiness, Rhythmus und light_version ein, wenn sie etwas erklären.
  Hohes Volumen bei RPE ≤ 6 heißt Luft nach oben; stagnierendes Volumen bei RPE 9–10 heißt zu schwer.
exercises: Genau ein Eintrag pro Übung der aktuellen Session (Cooldown-Übungen weglassen), exercise_id exakt übernehmen.
  trend: up = mehr als letztes Mal, flat = gleich, down = weniger, new = erste Session mit dieser Übung.
  text: eine Zeile mit der konkreten Veränderung, z.B. "+2 Wdh. im letzten Satz", "Gewicht gleich, RPE 9 → an der Grenze",
  "Volumen −8 %, Energie war 2/5".
recommendations: 2–3 Empfehlungen für die nächste Session, jede mit text. Wenn eine Empfehlung einen konkreten Zielwert
  für eine Übung nennt, setze zusätzlich exercise_id, field und value:
  - field weight_kg für Gewichtsübungen (type "wt"): kleine Schritte, 1–2,5 kg; value = neues Gewicht pro Satz
  - field reps für Körpergewichtsübungen (type "bw"): value = neue Ziel-Wiederholungen pro Satz
  - field duration_s für Halte-/Cardio-Übungen (type "time"/"cardio"): value = neue Zieldauer in Sekunden
  value ist immer der neue Zielwert, nie die Differenz. Allgemeine Tipps (Technik, Pause, Schlaf) ohne exercise_id/field/value.
  Bei RPE 9–10 oder trend down nicht steigern — dann Gewicht halten oder um einen Schritt zurück.
note_reply: nur wenn note gesetzt ist — ein Satz, der konkret darauf eingeht. Sonst weglassen.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['headline', 'verdict', 'exercises', 'recommendations'],
  properties: {
    headline: { type: 'STRING' },
    verdict: { type: 'STRING' },
    exercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['exercise_id', 'trend', 'text'],
        properties: {
          exercise_id: { type: 'STRING' },
          trend: { type: 'STRING', enum: TRENDS },
          text: { type: 'STRING' },
        },
      },
    },
    recommendations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        required: ['text'],
        properties: {
          text: { type: 'STRING' },
          exercise_id: { type: 'STRING' },
          field: { type: 'STRING', enum: COACH_FIELDS },
          value: { type: 'NUMBER' },
        },
      },
    },
    note_reply: { type: 'STRING' },
  },
};

const responseSchema = z.object({
  headline: z.string().min(1).max(120),
  verdict: z.string().min(1).max(1200),
  exercises: z
    .array(
      z.object({
        exercise_id: z.string().min(1),
        trend: z.enum(TRENDS),
        text: z.string().min(1).max(300),
      })
    )
    .max(30),
  recommendations: z
    .array(
      z.object({
        text: z.string().min(1).max(400),
        exercise_id: z.string().optional().nullable(),
        field: z.enum(COACH_FIELDS).optional().nullable(),
        value: z.number().optional().nullable(),
      })
    )
    .max(6),
  note_reply: z.string().max(400).optional().nullable(),
});

// Welche Zielwerte für welchen Übungstyp übernommen werden dürfen — und in welchem Rahmen.
const FIELD_RULES = {
  weight_kg: { types: ['wt'], min: 0.5, max: 500, integer: false },
  reps: { types: ['wt', 'bw'], min: 1, max: 100, integer: true },
  duration_s: { types: ['time', 'cardio'], min: 5, max: 3600, integer: true },
};

/** Prüft einen Zielwert gegen Übungstyp und Wertebereich. */
export function validHintValue(exerciseType, field, value) {
  const rule = FIELD_RULES[field];
  if (!rule || !rule.types.includes(exerciseType)) return false;
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < rule.min || value > rule.max) return false;
  if (rule.integer && !Number.isInteger(value)) return false;
  return true;
}

/**
 * Modell-Antwort → gespeicherte Auswertung. Unbekannte Übungs-Ids fliegen aus
 * `exercises`; bei Empfehlungen bleibt der Text, die Übernahme-Daten werden
 * gestrichen, wenn Id, Feld oder Wert nicht zur Übung passen.
 */
export function normalizeSummary(raw, exerciseMeta) {
  const parsed = responseSchema.parse(raw);

  const exercises = parsed.exercises
    .filter((entry) => exerciseMeta.has(entry.exercise_id))
    .map((entry) => ({
      exercise_id: entry.exercise_id,
      name: exerciseMeta.get(entry.exercise_id).name,
      trend: entry.trend,
      text: entry.text,
    }));

  const recommendations = parsed.recommendations.map((rec) => {
    const meta = rec.exercise_id ? exerciseMeta.get(rec.exercise_id) : null;
    const applicable = meta && rec.field && validHintValue(meta.type ?? 'bw', rec.field, rec.value);
    return applicable
      ? {
          text: rec.text,
          exercise_id: rec.exercise_id,
          exercise_name: meta.name,
          field: rec.field,
          value: rec.field === 'weight_kg' ? Math.round(rec.value * 10) / 10 : rec.value,
        }
      : { text: rec.text };
  });

  const summary = {
    headline: parsed.headline.trim(),
    verdict: parsed.verdict.trim(),
    exercises,
    recommendations,
  };
  if (parsed.note_reply?.trim()) summary.note_reply = parsed.note_reply.trim();
  return summary;
}

function setsForSession(db, sessionId) {
  const logs = db
    .prepare(
      `SELECT exercise_id, set_number, reps, weight_kg, duration_s FROM set_logs
       WHERE session_id = ? ORDER BY exercise_id, set_number`
    )
    .all(sessionId);
  const byExercise = new Map();
  for (const log of logs) {
    if (!byExercise.has(log.exercise_id)) byExercise.set(log.exercise_id, []);
    byExercise.get(log.exercise_id).push(log);
  }
  return byExercise;
}

function rpeForSession(db, sessionId) {
  return new Map(
    db
      .prepare('SELECT exercise_id, rpe FROM exercise_rpe WHERE session_id = ?')
      .all(sessionId)
      .map((row) => [row.exercise_id, row.rpe])
  );
}

function promptSet(log) {
  const set = { set: log.set_number };
  if (log.reps !== null) set.reps = log.reps;
  if (log.weight_kg !== null) set.weight_kg = log.weight_kg;
  if (log.duration_s !== null) {
    set.duration_s = log.duration_s;
    // Menschenlesbar, damit das Modell nicht "1500 Sekunden" schreibt.
    set.duration_display = formatDuration(log.duration_s);
  }
  return set;
}

function compact(metrics) {
  return Object.fromEntries(Object.entries(metrics ?? {}).filter(([, v]) => v != null));
}

function metricDelta(current, last) {
  const delta = {};
  for (const [key, value] of Object.entries(current ?? {})) {
    if (value == null || last?.[key] == null) continue;
    delta[key] = Math.round((value - last[key]) * 10) / 10;
  }
  return delta;
}

function formatExerciseSets(db, sessionId, exerciseMeta) {
  const rpeByExercise = rpeForSession(db, sessionId);
  return [...setsForSession(db, sessionId).entries()].map(([exerciseId, logs]) => {
    const meta = exerciseMeta.get(exerciseId);
    const entry = { id: exerciseId, name: meta?.name ?? exerciseId, type: meta?.type ?? 'bw', sets: logs.map(promptSet) };
    if (meta?.phase === 'cooldown') entry.phase = 'cooldown';
    const rpe = rpeByExercise.get(exerciseId);
    if (rpe != null) entry.rpe = rpe;
    return entry;
  });
}

function sessionDurationMin(db, session) {
  const row = db
    .prepare('SELECT MIN(created_at) AS first_set_at FROM set_logs WHERE session_id = ?')
    .get(session.id);
  if (!row?.first_set_at || !session.finished_at) return null;
  const start = Date.parse(`${row.first_set_at.replace(' ', 'T')}Z`);
  const end = Date.parse(`${session.finished_at.replace(' ', 'T')}Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 60000);
}

export function buildAggregate(db, session, plan) {
  const day = plan.days.find((d) => d.key === session.day_key);
  const adaptations = parseAdaptations(session.adaptations_json);

  const allPrevious = previousSessionsForRecords(db, session.user_id, session.id);

  // Getauschte Übungen (dieser und früherer Sessions) brauchen Namen im Prompt.
  const exerciseMeta = sessionExerciseMeta(day, adaptations);
  const prevRows = db
    .prepare(
      `SELECT id, started_at, note, adaptations_json FROM sessions
       WHERE user_id = ? AND day_key = ? AND status = 'finished' AND id != ?
       ORDER BY finished_at DESC LIMIT 5`
    )
    .all(session.user_id, session.day_key, session.id);
  for (const prev of prevRows) {
    for (const [id, exercise] of sessionExerciseMeta(null, parseAdaptations(prev.adaptations_json))) {
      if (!exerciseMeta.has(id)) exerciseMeta.set(id, exercise);
    }
  }

  const currentSets = setsForSession(db, session.id);
  const records = new Map(
    detectNewRecords(plan, currentSets, allPrevious).map((record) => [record.exercise_id, record])
  );

  const exercises = formatExerciseSets(db, session.id, exerciseMeta).map((entry) => {
    const meta = exerciseMeta.get(entry.id) ?? { type: entry.type };
    const history = allPrevious.filter((s) => s.setsByExercise.get(entry.id)?.length);
    const metrics = compact(sessionMetrics(meta, currentSets.get(entry.id) ?? []));
    const enriched = { ...entry, metrics };

    const last = history[history.length - 1];
    if (last) {
      const lastMetrics = sessionMetrics(meta, last.setsByExercise.get(entry.id));
      enriched.vs_last = { date: last.finished_at.slice(0, 10), ...metricDelta(metrics, lastMetrics) };
      enriched.best_before = compact(bestsForExercise(meta, history));
    } else {
      enriched.first_time = true;
    }

    const record = records.get(entry.id);
    if (record) enriched.new_record = { kind: record.kind, value: record.value, previous: record.previous, unit: record.unit };
    return enriched;
  });

  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN finished_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS last7,
         SUM(CASE WHEN finished_at >= datetime('now', '-28 days') THEN 1 ELSE 0 END) AS last28
       FROM sessions WHERE user_id = ? AND status = 'finished'`
    )
    .get(session.user_id);

  const aggregate = {
    day: day.name,
    session_number_for_day: allPrevious.filter((s) => s.day_key === session.day_key).length + 1,
    sessions_last_7_days: counts?.last7 ?? 1,
    sessions_last_28_days: counts?.last28 ?? 1,
    current_session: {
      date: session.started_at.slice(0, 10),
      exercises,
    },
    previous_sessions: prevRows.map((s) => ({
      date: s.started_at.slice(0, 10),
      exercises: formatExerciseSets(db, s.id, exerciseMeta),
      note: s.note || undefined,
    })),
  };

  const durationMin = sessionDurationMin(db, session);
  if (durationMin != null) aggregate.duration_display = formatDuration(durationMin * 60);

  if (session.note) aggregate.current_session.note = session.note;
  if (adaptations?.light) aggregate.light_version = true;

  if (session.readiness_json) {
    try {
      const { energy, soreness } = JSON.parse(session.readiness_json);
      aggregate.readiness = { energy, soreness };
    } catch {
      /* kaputtes JSON: ohne readiness weiter */
    }
  }

  const bodyweightLog = db
    .prepare(
      `SELECT date, value FROM max_tests WHERE user_id = ? AND kind = 'bodyweight'
       ORDER BY date DESC LIMIT 5`
    )
    .all(session.user_id);
  if (bodyweightLog.length > 0) {
    aggregate.bodyweight_log = bodyweightLog.reverse().map((b) => ({ date: b.date, kg: b.value }));
  }

  return { aggregate, exerciseMeta };
}

function fail(db, sessionId, message) {
  db.prepare(
    "UPDATE evaluations SET status = 'failed', error = ?, updated_at = datetime('now') WHERE session_id = ?"
  ).run(message, sessionId);
}

export async function runEvaluation(db, sessionId) {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  const planRow = db.prepare('SELECT json_payload FROM plans WHERE id = ?').get(session.plan_id);
  const plan = JSON.parse(planRow.json_payload);
  const { aggregate, exerciseMeta } = buildAggregate(db, session, plan);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    fail(db, sessionId, 'GEMINI_API_KEY not configured');
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS));
    const response = await Promise.race([
      ai.models.generateContent({
        model: MODEL,
        contents: JSON.stringify(aggregate),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
      timeout,
    ]);

    if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new Error('Antwort abgeschnitten (MAX_TOKENS)');
    }

    let raw;
    try {
      raw = JSON.parse(response.text);
    } catch {
      throw new Error('Antwort war kein gültiges JSON');
    }
    const summary = normalizeSummary(raw, exerciseMeta);

    db.prepare(
      "UPDATE evaluations SET status = 'ok', summary_json = ?, updated_at = datetime('now') WHERE session_id = ?"
    ).run(JSON.stringify(summary), sessionId);
  } catch (err) {
    fail(db, sessionId, err.message || 'unknown error');
  }
}
