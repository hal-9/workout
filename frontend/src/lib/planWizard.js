import { ZONE_LABELS } from 'shared/muscles';
import { libraryEntries, libraryEntryToExercise } from './exerciseLibrary.js';

// Ein Block = eine Muskelgruppe innerhalb eines Tages. `count` ist die Empfehlung,
// wie viele Übungen daraus in den Tag wandern — der Nutzer darf abweichen.
export const SPLITS = [
  {
    key: 'fullbody-2',
    title: 'Ganzkörper 2×',
    description: 'Zwei Einheiten pro Woche, jeder große Muskel zweimal dran.',
    days: [
      { key: 'ganzkoerper_a', name: 'Ganzkörper A', focus: 'Kniebeuge-Muster, Drücken, Ziehen',
        blocks: [['quads', 1], ['brust', 1], ['ruecken', 1], ['schultern', 1], ['core', 1]] },
      { key: 'ganzkoerper_b', name: 'Ganzkörper B', focus: 'Hüft-Muster, Drücken, Ziehen',
        blocks: [['hamstrings', 1], ['gesaess', 1], ['brust', 1], ['ruecken', 1], ['core', 1]] },
    ],
  },
  {
    key: 'ppl-3',
    title: 'Push / Pull / Beine',
    description: 'Der Klassiker für 3 Tage — klare Trennung, gute Erholung.',
    days: [
      { key: 'push', name: 'Push', focus: 'Brust, Schultern, Trizeps',
        blocks: [['brust', 2], ['schultern', 2], ['trizeps', 1]] },
      { key: 'pull', name: 'Pull', focus: 'Rücken, Bizeps',
        blocks: [['ruecken', 3], ['bizeps', 2]] },
      { key: 'beine', name: 'Beine', focus: 'Quadrizeps, Beinbeuger, Gesäß, Waden',
        blocks: [['quads', 2], ['hamstrings', 1], ['gesaess', 1], ['waden', 1], ['core', 1]] },
    ],
  },
  {
    key: 'fullbody-3',
    title: 'Ganzkörper 3×',
    description: 'Drei Einheiten, jedes Mal der ganze Körper. Gut für den Wiedereinstieg.',
    days: [
      { key: 'ganzkoerper_a', name: 'Ganzkörper A', focus: 'Kniebeuge-Muster',
        blocks: [['quads', 1], ['brust', 1], ['ruecken', 1], ['core', 1]] },
      { key: 'ganzkoerper_b', name: 'Ganzkörper B', focus: 'Hüft-Muster',
        blocks: [['gesaess', 1], ['hamstrings', 1], ['schultern', 1], ['ruecken', 1], ['core', 1]] },
      { key: 'ganzkoerper_c', name: 'Ganzkörper C', focus: 'Arme & Rest',
        blocks: [['quads', 1], ['brust', 1], ['bizeps', 1], ['trizeps', 1], ['waden', 1]] },
    ],
  },
  {
    key: 'upper-lower-4',
    title: 'Oberkörper / Unterkörper',
    description: 'Vier Tage, jede Hälfte zweimal pro Woche.',
    days: [
      { key: 'ober_a', name: 'Oberkörper A', focus: 'Drücken im Fokus',
        blocks: [['brust', 2], ['schultern', 1], ['ruecken', 2], ['trizeps', 1]] },
      { key: 'unter_a', name: 'Unterkörper A', focus: 'Quadrizeps im Fokus',
        blocks: [['quads', 2], ['hamstrings', 1], ['gesaess', 1], ['waden', 1]] },
      { key: 'ober_b', name: 'Oberkörper B', focus: 'Ziehen im Fokus',
        blocks: [['ruecken', 2], ['brust', 1], ['schultern', 1], ['bizeps', 1], ['core', 1]] },
      { key: 'unter_b', name: 'Unterkörper B', focus: 'Hüfte im Fokus',
        blocks: [['gesaess', 2], ['hamstrings', 2], ['quads', 1], ['core', 1]] },
    ],
  },
  {
    key: 'glute-core-4',
    title: 'Gesäß & Rumpf 4×',
    description: 'Vier Tage mit Schwerpunkt Po, Hüfte und Rumpfstabilität.',
    days: [
      { key: 'glutes_a', name: 'Gesäß A', focus: 'Hüftstreckung schwer',
        blocks: [['gesaess', 3], ['hamstrings', 1], ['core', 1]] },
      { key: 'ober', name: 'Oberkörper', focus: 'Drücken & Ziehen',
        blocks: [['ruecken', 2], ['brust', 1], ['schultern', 1]] },
      { key: 'glutes_b', name: 'Gesäß B', focus: 'Einbeinig & Abduktion',
        blocks: [['gesaess', 2], ['quads', 2], ['waden', 1]] },
      { key: 'core_tag', name: 'Rumpf & Rücken', focus: 'Stabilität',
        blocks: [['core', 3], ['unterer_ruecken', 2]] },
    ],
  },
  {
    key: 'ppl-6',
    title: 'Push / Pull / Beine ×2',
    description: 'Sechs Tage für Fortgeschrittene — jede Muskelgruppe zweimal.',
    days: [
      { key: 'push_a', name: 'Push A', focus: 'Brust schwer',
        blocks: [['brust', 3], ['schultern', 1], ['trizeps', 2]] },
      { key: 'pull_a', name: 'Pull A', focus: 'Vertikal ziehen',
        blocks: [['ruecken', 3], ['bizeps', 2]] },
      { key: 'beine_a', name: 'Beine A', focus: 'Quadrizeps',
        blocks: [['quads', 3], ['hamstrings', 1], ['waden', 1]] },
      { key: 'push_b', name: 'Push B', focus: 'Schultern schwer',
        blocks: [['schultern', 3], ['brust', 2], ['trizeps', 1]] },
      { key: 'pull_b', name: 'Pull B', focus: 'Horizontal ziehen',
        blocks: [['ruecken', 3], ['bizeps', 1], ['unterarme', 1]] },
      { key: 'beine_b', name: 'Beine B', focus: 'Gesäß & Beinbeuger',
        blocks: [['gesaess', 2], ['hamstrings', 2], ['quads', 1], ['core', 1]] },
    ],
  },
];

export function findSplit(key) {
  return SPLITS.find((split) => split.key === key) ?? null;
}

export function blockLabel(zone) {
  return ZONE_LABELS[zone] ?? zone;
}

// Verbundübungen zuerst — sie treffen mehr Zonen und gehören an den Anfang des Tages.
function proposalRank(entry) {
  return entry.zones?.primary?.length >= 2 ? 0 : 1;
}

/** Vorschläge für eine Zone, gefiltert nach vorhandener Ausrüstung. */
export function proposalsFor(zone, equipment, entries = libraryEntries()) {
  const available = equipment instanceof Set ? equipment : new Set(equipment ?? []);
  return entries
    .filter((entry) => entry.phase === 'main')
    .filter((entry) => entry.zones?.primary?.includes(zone))
    .filter((entry) => available.size === 0 || available.has(entry.equipment))
    .sort((a, b) => proposalRank(a) - proposalRank(b) || a.name.localeCompare(b.name, 'de'));
}

/** Vorauswahl: die ersten `count` Vorschläge, ohne Dopplung innerhalb des Tages. */
export function defaultSelection(split, equipment, entries = libraryEntries()) {
  const selection = {};
  for (const day of split.days) {
    const usedInDay = new Set();
    for (const [zone, count] of day.blocks) {
      const picks = proposalsFor(zone, equipment, entries)
        .filter((entry) => !usedInDay.has(entry.id))
        .slice(0, count);
      picks.forEach((entry) => usedInDay.add(entry.id));
      selection[`${day.key}:${zone}`] = picks.map((entry) => entry.id);
    }
  }
  return selection;
}

export function selectionCount(selection) {
  return Object.values(selection).reduce((sum, ids) => sum + ids.length, 0);
}

/** Auswahl → Plan im Schema-Format. Tage ohne Übung fallen raus. */
export function buildPlanFromSelection({ name, split, selection, entries = libraryEntries() }) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const usedIds = new Set();
  const days = split.days
    .map((day) => {
      const exercises = day.blocks.flatMap(([zone]) =>
        (selection[`${day.key}:${zone}`] ?? [])
          .map((entryId) => byId.get(entryId))
          .filter(Boolean)
          .map((entry) => libraryEntryToExercise(entry, usedIds))
      );
      return { key: day.key, name: day.name, focus: day.focus, weekday: null, exercises };
    })
    .filter((day) => day.exercises.length > 0);

  return {
    schema_version: 1,
    name: name.trim() || 'Mein Trainingsplan',
    music_url: null,
    days,
  };
}
