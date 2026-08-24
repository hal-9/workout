import library from '../data/exercises.json' with { type: 'json' };
import { uniqueSlug } from './planDefaults.js';

export const STRETCH_GROUP = 'Dehnung';

// Reihenfolge entscheidet bei Gleichstand — deshalb stehen Core und Gesäß vor Rücken
// ("Core/Rücken" ist Core, "Po/Rücken" ist Gesäß).
export const MUSCLE_GROUPS = [
  { key: 'Brust', keywords: ['brust'] },
  { key: 'Schultern', keywords: ['schulter', 'nacken'] },
  { key: 'Arme', keywords: ['bizeps', 'trizeps', 'unterarm'] },
  { key: 'Core', keywords: ['core', 'bauch', 'rumpf', 'flanke', 'wirbelsäule'] },
  { key: 'Gesäß & Hüfte', keywords: ['po', 'gesäß', 'glute', 'hüfte', 'hüftbeuger', 'adduktor'] },
  { key: 'Beine', keywords: ['bein', 'quadrizeps', 'oberschenkel', 'hamstring', 'wade'] },
  { key: 'Rücken', keywords: ['rücken', 'lat', 'lendenwirbel'] },
  { key: 'Cardio', keywords: ['cardio', 'ausdauer'] },
];

function hits(text, keywords) {
  return keywords.filter((word) => text.includes(word)).length;
}

export function muscleGroup(entry) {
  if (entry?.phase === 'cooldown') return STRETCH_GROUP;
  const text = String(entry?.muscle ?? '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const group of MUSCLE_GROUPS) {
    const score = hits(text, group.keywords);
    if (score > bestScore) {
      best = group.key;
      bestScore = score;
    }
  }
  return best ?? 'Sonstige';
}

export function libraryEntries() {
  return library.map((entry) => ({ ...entry, group: muscleGroup(entry) }));
}

export function libraryGroups() {
  const present = new Set(libraryEntries().map((entry) => entry.group));
  const ordered = [...MUSCLE_GROUPS.map((g) => g.key), STRETCH_GROUP, 'Sonstige'];
  return ordered.filter((key) => present.has(key));
}

function normalize(text) {
  return String(text ?? '').toLowerCase().trim();
}

export function searchLibrary(query, group, entries = libraryEntries()) {
  const needle = normalize(query);
  return entries.filter((entry) => {
    if (group && entry.group !== group) return false;
    if (!needle) return true;
    return (
      normalize(entry.name).includes(needle) ||
      normalize(entry.muscle).includes(needle) ||
      normalize(entry.cue).includes(needle)
    );
  });
}

/** Bibliothekseintrag in eine Plan-Übung überführen — mit eindeutiger Id. */
export function libraryEntryToExercise(entry, existingIds = new Set()) {
  const exercise = {
    id: uniqueSlug(entry.id, existingIds),
    name: entry.name,
    muscle: entry.muscle,
    type: entry.type,
    sets: entry.sets,
    target_reps: entry.target_reps ?? null,
    target_seconds: entry.target_seconds ?? null,
    default_weight_kg: entry.default_weight_kg ?? null,
    cue: entry.cue ?? '',
    video_query: entry.video_query ?? '',
    phase: entry.phase === 'cooldown' ? 'cooldown' : 'main',
  };
  return exercise;
}

/** YouTube-Suche statt Embed — kein externes Skript, keine CSP-Probleme. */
export function demoSearchUrl(exercise) {
  const query = exercise?.video_query?.trim() || `${exercise?.name ?? ''} Technik`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}
