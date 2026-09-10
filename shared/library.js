// Übungsbibliothek als gemeinsame Datenquelle für Frontend (Picker, Tausch)
// und Backend (Namen/Zonen für Auswertung und Statistik).
import entries from './exercises.json' with { type: 'json' };
import { registerLibraryLookup } from './muscles.js';

export const LIBRARY = entries;

function normalizeName(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9äöüß]+/g, ' ')
    .trim();
}

const byId = new Map(entries.map((entry) => [entry.id, entry]));
const byName = new Map();
for (const entry of entries) {
  byName.set(normalizeName(entry.name), entry);
  for (const alias of entry.aliases ?? []) {
    const key = normalizeName(alias);
    if (key && !byName.has(key)) byName.set(key, entry);
  }
}

/**
 * Bibliothekseintrag zu einer Plan-Übung: erst exakte Id (Vorlagen, Wizard),
 * dann normalisierter Name oder Alias ("Push-Up" → Liegestütze). Kein Fuzzy-
 * Matching — lieber keine Zonen als falsche.
 */
export function findLibraryEntry(exercise) {
  if (!exercise) return null;
  const direct = byId.get(exercise.id);
  if (direct) return direct;
  const nameKey = normalizeName(exercise.name);
  return (nameKey && byName.get(nameKey)) ?? null;
}

registerLibraryLookup(findLibraryEntry);
