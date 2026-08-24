import { isCooldown } from 'shared/exerciseProgress';
import { progressionConfig } from 'shared/progression';

export const DEFAULT_DELOAD_FACTOR = 0.9;

export function supportsProgression(exercise) {
  if (!exercise || isCooldown(exercise)) return false;
  return exercise.type === 'wt' || exercise.type === 'bw' || exercise.type === 'time';
}

/** Was der Editor anzeigen soll: aktive Werte plus Ein/Aus-Zustand. */
export function effectiveProgression(exercise) {
  const config = progressionConfig(exercise);
  if (!config) {
    return { enabled: false, type: null, increment: null, after_success: null, deload_every_weeks: null };
  }
  return {
    enabled: true,
    type: config.type,
    increment: config.increment,
    after_success: config.after_success,
    deload_every_weeks: config.deload_every_weeks,
  };
}

/**
 * Schreibt Progressions-Felder explizit in die Übung.
 * `enabled: false` setzt `progression: null` (bewusst abgeschaltet).
 */
export function withProgression(exercise, patch) {
  if (patch.enabled === false) {
    return { ...exercise, progression: null };
  }

  // Beim Wiedereinschalten müssen die Typ-Voreinstellungen greifen, nicht der
  // abgeschaltete Zustand — deshalb ohne progression-Feld auswerten.
  const defaults = progressionConfig({ ...exercise, progression: undefined });
  const current = exercise.progression ? progressionConfig(exercise) : null;
  const base = current ?? defaults;
  if (!base) return exercise;

  const next = {
    type: patch.type ?? base.type,
    increment: Number(patch.increment ?? base.increment),
    after_success: Number(patch.after_success ?? base.after_success),
  };

  const deload = patch.deload_every_weeks ?? base.deload_every_weeks;
  if (deload) {
    next.deload_every_weeks = Number(deload);
    next.deload_factor = exercise.progression?.deload_factor ?? DEFAULT_DELOAD_FACTOR;
  }

  return { ...exercise, progression: next };
}

/** Deload gilt planweit — kleinster konfigurierter Wert gewinnt. */
export function planDeloadWeeks(plan) {
  const values = (plan?.days ?? [])
    .flatMap((day) => day.exercises ?? [])
    .map((exercise) => progressionConfig(exercise)?.deload_every_weeks)
    .filter((value) => value);
  return values.length ? Math.min(...values) : null;
}

/** Setzt (oder entfernt) die Deload-Wochen auf allen Übungen mit aktiver Steigerung. */
export function withPlanDeload(plan, weeks) {
  const value = weeks ? Number(weeks) : null;
  return {
    ...plan,
    days: (plan?.days ?? []).map((day) => ({
      ...day,
      exercises: (day.exercises ?? []).map((exercise) => {
        if (!supportsProgression(exercise)) return exercise;
        const current = effectiveProgression(exercise);
        if (!current.enabled) return exercise;
        const next = withProgression(exercise, { deload_every_weeks: value });
        if (value) return next;
        const withoutDeload = { ...next.progression };
        delete withoutDeload.deload_every_weeks;
        delete withoutDeload.deload_factor;
        return { ...next, progression: withoutDeload };
      }),
    })),
  };
}
