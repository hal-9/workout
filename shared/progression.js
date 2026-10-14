import { isCooldown, parseTargetReps } from './exerciseProgress.js';
import { workingSets } from './setTypes.js';
import { equipmentKey, weightStep } from './equipment.js';

// Voreinstellungen je Übungstyp. Cardio ist absichtlich aus: Intervalle werden
// vom Nutzer vorgegeben, nicht automatisch hochgeschraubt. Der Gewichtsschritt
// kommt vom Gerät (`weightStep`), nicht aus einer festen Zahl.
const TYPE_DEFAULTS = {
  wt: { type: 'weight', increment: null, after_success: 2 },
  bw: { type: 'reps', increment: 2, after_success: 2 },
  time: { type: 'duration', increment: 10, after_success: 2 },
  cardio: null,
};

/**
 * Effektive Progressions-Konfiguration einer Übung.
 * `progression: null` im Plan schaltet die Automatik bewusst ab.
 */
export function progressionConfig(exercise) {
  if (!exercise || isCooldown(exercise)) return null;
  if (exercise.progression === null) return null;

  const defaults = TYPE_DEFAULTS[exercise.type] ?? null;
  const base = defaults?.type === 'weight' ? { ...defaults, increment: weightStep(exercise) } : defaults;
  if (!exercise.progression) return base;

  const merged = { ...(base ?? {}), ...exercise.progression };
  if (!merged.type || !merged.increment) return null;
  return {
    type: merged.type,
    increment: Number(merged.increment),
    after_success: Math.max(1, Number(merged.after_success ?? 1)),
    deload_every_weeks: merged.deload_every_weeks ?? null,
    deload_factor: merged.deload_factor ?? 0.9,
  };
}

function plannedSets(exercise) {
  return Math.max(1, Number(exercise.sets) || 1);
}

// Eine Session gilt als "geschafft", wenn alle geplanten Sätze das Ziel erreichen.
export function sessionQualifies(exercise, config, sets = []) {
  const planned = plannedSets(exercise);
  const relevant = workingSets(sets).slice(0, planned);
  if (relevant.length < planned) return false;

  if (config.type === 'duration') {
    const target = Number(exercise.target_seconds) || 0;
    if (!target) return false;
    return relevant.every((s) => (Number(s.duration_s) || 0) >= target);
  }

  const target = parseTargetReps(exercise.target_reps);
  if (!target) return false;
  const atTopReps = relevant.every((s) => (Number(s.reps) || 0) >= target.max);
  if (!atTopReps) return false;

  if (config.type === 'weight') {
    // Nur zählen, wenn mindestens mit dem aktuellen Plan-Gewicht gearbeitet wurde.
    const current = Number(exercise.default_weight_kg) || 0;
    return relevant.every((s) => (Number(s.weight_kg) || 0) >= current);
  }

  return true;
}

function roundKg(value) {
  return Math.round(value * 10) / 10;
}

export function nextTargetReps(targetReps, increment) {
  const parsed = parseTargetReps(targetReps);
  if (!parsed) return null;
  const min = parsed.min + increment;
  const max = parsed.max + increment;
  return min === max ? String(min) : `${min}-${max}`;
}

// Gewicht, das jemand als „nicht vorhanden" markiert hat: 'kurzhantel|12.5'.
export function unavailableKey(exercise, kg) {
  return `${equipmentKey(exercise)}|${roundKg(Number(kg))}`;
}

function buildProposal(exercise, config, unavailable) {
  if (config.type === 'weight') {
    const from = Number(exercise.default_weight_kg) || 0;
    const to = roundKg(from + config.increment);
    if (!unavailable.has(unavailableKey(exercise, to))) {
      return { field: 'default_weight_kg', from, to, unit: 'kg' };
    }
    // Nächstes Gewicht gibt es nicht: mit dem gleichen Gewicht eine
    // Wiederholung mehr — nie ein größerer Sprung, nie ein erfundenes Gewicht.
    const reps = parseTargetReps(exercise.target_reps);
    if (!reps) return null;
    const next = reps.min === reps.max ? String(reps.max + 1) : `${reps.min}-${reps.max + 1}`;
    return { field: 'target_reps', from: exercise.target_reps, to: next, unit: 'Wdh.', unavailable_kg: to };
  }

  if (config.type === 'duration') {
    const from = Number(exercise.target_seconds) || 0;
    if (!from) return null;
    return { field: 'target_seconds', from, to: from + config.increment, unit: 's' };
  }

  const to = nextTargetReps(exercise.target_reps, config.increment);
  if (!to) return null;
  return { field: 'target_reps', from: exercise.target_reps, to, unit: 'Wdh.' };
}

/** Explainable rationale for a progression proposal (German UI copy). */
export function proposalRationale(exercise, config, proposal) {
  const count = proposal?.sessions_in_streak ?? config?.after_success ?? 1;
  const streakLabel = count > 1 ? `${count}× am Ziel` : 'Ziel erreicht';

  if (proposal?.field === 'default_weight_kg') {
    const target = parseTargetReps(exercise.target_reps);
    const repsHint = target ? `${target.max} Wdh.` : 'Ziel';
    return `${streakLabel}: ${repsHint} in allen Arbeitssätzen · +${config.increment} kg empfohlen`;
  }

  if (proposal?.field === 'target_seconds') {
    return `${streakLabel}: Zieldauer erreicht · +${config.increment} s empfohlen`;
  }

  if (proposal?.unavailable_kg != null) {
    return `${streakLabel}: ${String(proposal.unavailable_kg).replace('.', ',')} kg nicht vorhanden · eine Wdh. mehr`;
  }

  if (proposal?.field === 'target_reps') {
    return `${streakLabel}: Wiederholungen am oberen Ende · Bereich erhöhen`;
  }

  return streakLabel;
}

/**
 * Prüft eine Übung gegen ihre letzten Sessions (älteste zuerst) und liefert
 * einen Vorschlag, wenn `after_success` Sessions in Folge das Ziel erreicht haben.
 */
export function evaluateExercise(exercise, sessionsOldestFirst = [], unavailable = new Set()) {
  const config = progressionConfig(exercise);
  if (!config) return null;

  const withSets = sessionsOldestFirst.filter((s) => s.sets?.length);
  if (withSets.length < config.after_success) return null;

  const streak = withSets.slice(-config.after_success);
  if (!streak.every((s) => sessionQualifies(exercise, config, s.sets))) return null;

  const change = buildProposal(exercise, config, unavailable);
  if (!change || change.to === change.from) return null;

  const planned = plannedSets(exercise);
  const proposal = {
    exercise_id: exercise.id,
    name: exercise.name,
    type: config.type,
    sessions_in_streak: streak.length,
    // Belege für das "Warum?" im UI: genau die Sessions, die die Serie bilden.
    evidence: streak.map((session) => ({
      session_id: session.session_id,
      finished_at: session.finished_at ?? null,
      sets: workingSets(session.sets)
        .slice(0, planned)
        .map((s) => ({
          reps: s.reps ?? null,
          weight_kg: s.weight_kg ?? null,
          duration_s: s.duration_s ?? null,
        })),
    })),
    ...change,
  };
  proposal.rationale = proposalRationale(exercise, config, proposal);
  return proposal;
}

/**
 * Vorschläge für alle Übungen eines Plans.
 * `setsByExerciseBySession`: Array von Maps (älteste Session zuerst).
 */
export function evaluatePlan(plan, sessionsOldestFirst = [], unavailable = new Set()) {
  const proposals = [];
  for (const day of plan?.days ?? []) {
    for (const exercise of day.exercises ?? []) {
      const perExercise = sessionsOldestFirst
        .map((session) => ({
          session_id: session.session_id,
          finished_at: session.finished_at ?? null,
          sets: session.setsByExercise?.get(exercise.id) ?? [],
        }))
        .filter((s) => s.sets.length);
      const proposal = evaluateExercise(exercise, perExercise, unavailable);
      if (proposal) proposals.push(proposal);
    }
  }
  return proposals;
}

/** Neue Plan-Version mit den angenommenen Vorschlägen. Der Eingabe-Plan bleibt unberührt. */
export function applyProposals(plan, proposals = []) {
  const byId = new Map(proposals.map((p) => [p.exercise_id, p]));
  if (!byId.size) return plan;

  return {
    ...plan,
    days: (plan.days ?? []).map((day) => ({
      ...day,
      exercises: (day.exercises ?? []).map((exercise) => {
        const proposal = byId.get(exercise.id);
        if (!proposal) return exercise;
        return { ...exercise, [proposal.field]: proposal.to };
      }),
    })),
  };
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

/**
 * Deload-Woche: nur wenn der Plan sie konfiguriert (`deload_every_weeks`).
 * Ohne Konfiguration passiert nichts — kein Banner aus dem Nichts.
 */
export function deloadWeek(plan, planStartMs, nowMs) {
  const configs = (plan?.days ?? [])
    .flatMap((day) => day.exercises ?? [])
    .map((exercise) => progressionConfig(exercise))
    .filter((config) => config?.deload_every_weeks);

  if (!configs.length || !planStartMs || !nowMs) return null;

  const every = Math.min(...configs.map((c) => c.deload_every_weeks));
  const factor = Math.min(...configs.map((c) => c.deload_factor ?? 0.9));
  const weeksSinceStart = Math.floor((nowMs - planStartMs) / WEEK_MS);

  if (weeksSinceStart < every || weeksSinceStart % every !== 0) return null;
  return { week: weeksSinceStart, every, factor };
}
