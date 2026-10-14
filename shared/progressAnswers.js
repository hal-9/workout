import { formatDuration } from './duration.js';

// „Werde ich besser?" — ehrlicher Vergleich der letzten zwei Workouts einer
// Übung. Nur was direkt vergleichbar ist, wird als Fortschritt bezeichnet:
// gleiche Satzzahl, gleiche Bänder, Satz für Satz. Kein Tonnage-/1RM-Ranking.

const deKg = (kg) => String(Math.round(kg * 100) / 100).replace('.', ',');
const n = (v) => Number(v) || 0;
const sum = (values) => values.reduce((a, b) => a + b, 0);

/**
 * kind: 'more_reps' | 'more_weight' | 'longer' | 'held' | 'not_comparable'
 * Cardio liefert null — längere Zeit ist dort nicht automatisch besser.
 */
export function compareExposures(exercise, prevSets = [], lastSets = []) {
  if (exercise?.type === 'cardio') return null;
  const prev = [...prevSets].sort((a, b) => a.set_number - b.set_number);
  const last = [...lastSets].sort((a, b) => a.set_number - b.set_number);
  const name = exercise?.name ?? '';
  const notComparable = { kind: 'not_comparable', text: `${name}: nicht direkt vergleichbar` };

  if (!prev.length || !last.length) return null;
  if (prev.length !== last.length) return notComparable;
  if (prev.some((s, i) => n(s.band_count) !== n(last[i].band_count))) return notComparable;

  if (exercise.type === 'time') {
    const a = prev.map((s) => n(s.duration_s));
    const b = last.map((s) => n(s.duration_s));
    if (b.every((v, i) => v === a[i])) return { kind: 'held', text: `${name}: Leistung gehalten` };
    if (b.every((v, i) => v >= a[i])) {
      return { kind: 'longer', text: `${name}: ${formatDuration(Math.max(...a))} → ${formatDuration(Math.max(...b))} gehalten` };
    }
    return notComparable;
  }

  const repsA = prev.map((s) => n(s.reps));
  const repsB = last.map((s) => n(s.reps));
  const kgA = prev.map((s) => n(s.weight_kg));
  const kgB = last.map((s) => n(s.weight_kg));
  const sameWeight = kgB.every((v, i) => v === kgA[i]);
  const repsHeld = repsB.every((v, i) => v >= repsA[i]);
  const setsLabel = prev.length === 1 ? '' : ` in ${prev.length} Sätzen`;

  if (sameWeight && repsB.every((v, i) => v === repsA[i])) {
    return { kind: 'held', text: `${name}: Leistung gehalten` };
  }
  if (sameWeight && repsHeld) {
    const weight = Math.max(...kgB) > 0 ? 'gleichem Gewicht' : 'gleicher Ausführung';
    return { kind: 'more_reps', text: `${name}: ${sum(repsA)} → ${sum(repsB)} Wdh.${setsLabel} bei ${weight}` };
  }
  if (repsHeld && kgB.every((v, i) => v >= kgA[i])) {
    return {
      kind: 'more_weight',
      text: `${name}: ${deKg(Math.max(...kgA))} → ${deKg(Math.max(...kgB))} kg bei mindestens gleichen Wdh.`,
    };
  }
  return notComparable;
}

const IMPROVED = new Set(['more_reps', 'more_weight', 'longer']);

/**
 * Höchstens zwei Fakten, in Plan-Reihenfolge: erst echte Verbesserungen,
 * sonst gehaltene Leistung. `comparisons` = [{ exercise, ...compareExposures }].
 */
export function pickImprovementFacts(comparisons, limit = 2) {
  const valid = comparisons.filter(Boolean);
  const improved = valid.filter((c) => IMPROVED.has(c.kind));
  const held = valid.filter((c) => c.kind === 'held');
  return [...improved, ...held].slice(0, limit);
}
