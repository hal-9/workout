// Übungs-Tausch im Workout: Alternativen aus der Bibliothek finden, bewerten
// und erklären. Rein abgeleitet, kein Backend — die Persistenz des Tauschs
// läuft über sessions.adaptations_json.replaced.
import {
  EQUIPMENT_LABELS,
  PATTERN_LABELS,
  ZONE_LABELS,
  exerciseZones,
  zoneOverlap,
} from 'shared/muscles';
import { findLibraryEntry } from 'shared/library';
import { libraryEntries } from './exerciseLibrary.js';
import { uniqueSlug } from './planDefaults.js';

export const RATINGS = {
  equal: { key: 'equal', label: 'Gleichwertig', rank: 3 },
  good: { key: 'good', label: 'Guter Ersatz', rank: 2 },
  partial: { key: 'partial', label: 'Teilweise', rank: 1 },
};

// Gewichte der Überdeckung: Primär↔Primär zählt am meisten, ein gemeinsames
// Bewegungsmuster fast genauso viel. Zusätzliche Primärmuskeln der Alternative
// sind kein Malus (mehr trainieren ist okay), fehlende sind einer.
const W = { pp: 3, ps: 1.5, sp: 1, ss: 0.5, pattern: 2.5, sameType: 0.5, missing: 1.5 };

function bestOverlap(key, list) {
  let best = 0;
  for (const other of list) best = Math.max(best, zoneOverlap(key, other));
  return best;
}

export function patternOf(exercise) {
  return exercise?.pattern ?? findLibraryEntry(exercise)?.pattern ?? null;
}

/**
 * Bewertet eine Alternative gegen die Original-Übung. Liefert Score, Rating und
 * verständliche Gründe für die Anzeige.
 */
export function scoreAlternative(original, candidate) {
  const oz = exerciseZones(original);
  const cz = exerciseZones(candidate);
  const oPattern = patternOf(original);
  const cPattern = patternOf(candidate);

  let score = 0;
  const covered = []; // Primärzonen des Originals, die die Alternative primär trifft
  const coveredSecondary = []; // ... die sie nur sekundär trifft
  const missing = [];
  for (const key of oz.primary) {
    const asPrimary = bestOverlap(key, cz.primary);
    const asSecondary = bestOverlap(key, cz.secondary);
    if (asPrimary > 0) {
      score += W.pp * asPrimary;
      covered.push(key);
    } else if (asSecondary > 0) {
      score += W.ps * asSecondary;
      coveredSecondary.push(key);
    } else {
      score -= W.missing;
      missing.push(key);
    }
  }
  for (const key of oz.secondary) {
    score += W.sp * bestOverlap(key, cz.primary);
    score += W.ss * bestOverlap(key, cz.secondary);
  }
  const extra = cz.primary.filter((key) => bestOverlap(key, [...oz.primary, ...oz.secondary]) === 0);

  const samePattern = Boolean(oPattern && cPattern && oPattern === cPattern);
  if (samePattern) score += W.pattern;
  if (original.type === candidate.type) score += W.sameType;

  const allPrimaryCovered = oz.primary.length > 0 && missing.length === 0 && coveredSecondary.length === 0;
  let rating;
  if (allPrimaryCovered && samePattern) rating = RATINGS.equal;
  else if (allPrimaryCovered || (samePattern && missing.length === 0)) rating = RATINGS.good;
  else rating = RATINGS.partial;

  const reasons = [];
  if (samePattern) reasons.push({ kind: 'pattern', text: `Gleiches Bewegungsmuster: ${PATTERN_LABELS[cPattern] ?? cPattern}` });
  else if (cPattern && oPattern) reasons.push({ kind: 'pattern-diff', text: `Anderes Muster: ${PATTERN_LABELS[cPattern] ?? cPattern} statt ${PATTERN_LABELS[oPattern] ?? oPattern}` });
  if (covered.length) reasons.push({ kind: 'covered', text: `Trainiert ebenfalls: ${covered.map((k) => ZONE_LABELS[k] ?? k).join(', ')}` });
  if (coveredSecondary.length) reasons.push({ kind: 'secondary', text: `Nur mitarbeitend: ${coveredSecondary.map((k) => ZONE_LABELS[k] ?? k).join(', ')}` });
  if (missing.length) reasons.push({ kind: 'missing', text: `Fehlt: ${missing.map((k) => ZONE_LABELS[k] ?? k).join(', ')}` });
  if (extra.length) reasons.push({ kind: 'extra', text: `Zusätzlich: ${extra.map((k) => ZONE_LABELS[k] ?? k).join(', ')}` });

  return { score, rating, reasons, samePattern, covered, coveredSecondary, missing, extra };
}

function normalize(text) {
  return String(text ?? '').toLowerCase().trim();
}

/**
 * Alternativen für eine Übung, beste zuerst.
 * - equipment: Set/Array von Geräte-Keys; leer = alle.
 * - excludeIds/excludeNames: Übungen des Tages (keine Dopplung).
 * - query: Freitext-Suche über Name, Muskel, Alias.
 * Ohne echte Überdeckung (Primärmuskel oder Muster) wird nichts vorgeschlagen — außer die Suche fragt gezielt danach.
 */
export function rankAlternatives(original, { entries = libraryEntries(), equipment = [], excludeIds = new Set(), excludeNames = new Set(), query = '' } = {}) {
  const available = equipment instanceof Set ? equipment : new Set(equipment ?? []);
  const needle = normalize(query);
  const originalEntry = findLibraryEntry(original);
  const out = [];
  for (const entry of entries) {
    if (entry.phase === 'cooldown') continue;
    if (entry.id === original.id || entry.id === originalEntry?.id) continue;
    if (excludeIds.has(entry.id) || excludeNames.has(normalize(entry.name))) continue;
    if (available.size && !available.has(entry.equipment)) continue;
    if (needle) {
      const hay = [entry.name, entry.muscle, ...(entry.aliases ?? [])].map(normalize).join(' ');
      if (!hay.includes(needle)) continue;
    }
    const result = scoreAlternative(original, entry);
    // Ohne Suche nur echte Alternativen: mindestens ein Primärmuskel des
    // Originals primär getroffen oder gleiches Bewegungsmuster. „Nur mitarbeitend"
    // (z. B. Liegestütze für Schulterdrücken) reicht nicht.
    if (!needle && result.covered.length === 0 && !result.samePattern) continue;
    if (!needle && result.score <= 0) continue;
    out.push({ entry, ...result });
  }
  out.sort((a, b) => b.rating.rank - a.rating.rank || b.score - a.score || a.entry.name.localeCompare(b.entry.name, 'de'));
  return out;
}

/**
 * Bibliothekseintrag → Session-Übung als Ersatz. Satzzahl kommt vom Original
 * (das Workout-Volumen bleibt), Ziel und Gewicht vom Ersatz — andere Übung,
 * andere Vorgabe. Id bleibt über Sessions stabil, solange sie nicht mit dem
 * Plan kollidiert (dann -2, -3 …).
 */
export function buildReplacement(original, entry, planIds = new Set()) {
  return {
    id: uniqueSlug(entry.id, new Set(planIds)),
    name: entry.name,
    muscle: entry.muscle,
    type: entry.type,
    sets: original?.sets ?? entry.sets,
    target_reps: entry.target_reps ?? null,
    target_seconds: entry.target_seconds ?? null,
    default_weight_kg: entry.default_weight_kg ?? null,
    cue: entry.cue ?? '',
    video_query: entry.video_query ?? '',
    phase: 'main',
    zones: entry.zones,
    equipment: entry.equipment,
    pattern: entry.pattern,
  };
}

/** Plan-Tag mit Session-Tauschen: Ersatz steht an der Stelle des Originals. */
export function applyReplacements(day, replaced = []) {
  if (!day || !replaced?.length) return day;
  const byOriginal = new Map(replaced.map((r) => [r.original_id, r.exercise]));
  return {
    ...day,
    exercises: day.exercises.map((exercise) => byOriginal.get(exercise.id) ?? exercise),
  };
}

export function equipmentLabel(key) {
  return EQUIPMENT_LABELS[key] ?? key;
}
