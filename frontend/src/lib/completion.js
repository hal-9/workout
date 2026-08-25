import { isCooldown } from 'shared/exerciseProgress';
import { sessionTonnage } from 'shared/records';
import { isWarmupSet } from 'shared/setTypes';

/**
 * Kennzahlen für den Abschluss-Screen. Cooldown-Sätze werden getrennt gezählt,
 * damit die Satzzahl des Hauptteils vergleichbar bleibt.
 */
export function summarizeSession(day, summary, elapsedMs) {
  const byId = new Map((day?.exercises ?? []).map((ex) => [ex.id, ex]));

  let sets = 0;
  let cooldownSets = 0;
  let tonnage = 0;
  let exercises = 0;

  for (const item of summary?.exercises ?? []) {
    const exercise = byId.get(item.exercise_id);
    const count = (item.sets ?? []).filter((s) => !isWarmupSet(s)).length;
    if (!count) continue;

    if (exercise && isCooldown(exercise)) {
      cooldownSets += count;
      continue;
    }

    sets += count;
    exercises += 1;
    if (exercise) tonnage += sessionTonnage(exercise, (item.sets ?? []).filter((s) => !isWarmupSet(s)));
  }

  return {
    sets,
    cooldown_sets: cooldownSets,
    exercises,
    tonnage_kg: Math.round(tonnage),
    duration_min:
      elapsedMs && elapsedMs > 0 ? Math.max(1, Math.round(elapsedMs / 60000)) : null,
  };
}

export function completionHeadline(records = []) {
  if (records.length === 1) return 'Neuer Rekord!';
  if (records.length > 1) return `${records.length} neue Rekorde!`;
  return 'Workout geschafft';
}

// Kleine Zahlen hochzählen sieht kaputt aus (1 steht fast die ganze Zeit auf 0).
export const COUNT_UP_MIN = 10;

export function shouldCountUp(target) {
  return Number.isFinite(target) && target >= COUNT_UP_MIN;
}

export function easeOutCubic(t) {
  const clamped = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - clamped, 3);
}

// Partikel deterministisch verteilen — kein Math.random, damit es ruhig wirkt.
export function particleLayout(count = 14) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 2 ? 0.22 : -0.22);
    const distance = 74 + (i % 3) * 22;
    return {
      id: i,
      dx: Math.round(Math.cos(angle) * distance),
      dy: Math.round(Math.sin(angle) * distance),
      size: i % 3 === 0 ? 7 : 5,
      delay: 120 + (i % 5) * 26,
      accent: i % 2 === 0,
    };
  });
}
