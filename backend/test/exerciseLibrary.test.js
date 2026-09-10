import { describe, it, expect } from 'vitest';
import { planSchema } from 'shared';
import { EQUIPMENT_KEYS, LEAF_ZONES, MUSCLE_ZONES, PATTERN_KEYS, ZONE_CHILDREN } from 'shared/muscles';
import {
  demoSearchUrl,
  libraryEntries,
  libraryEntryToExercise,
  libraryGroups,
  muscleGroup,
  searchLibrary,
} from '../../frontend/src/lib/exerciseLibrary.js';

describe('muscleGroup', () => {
  it('ordnet die Muskel-Bezeichnungen der Templates zu', () => {
    expect(muscleGroup({ muscle: 'Brust' })).toBe('Brust');
    expect(muscleGroup({ muscle: 'Latissimus' })).toBe('Rücken');
    expect(muscleGroup({ muscle: 'Unterer Rücken' })).toBe('Rücken');
    expect(muscleGroup({ muscle: 'Nacken' })).toBe('Schultern');
    expect(muscleGroup({ muscle: 'Oberschenkelrückseite' })).toBe('Beine');
    expect(muscleGroup({ muscle: 'Hamstrings' })).toBe('Beine');
    expect(muscleGroup({ muscle: 'Ausdauer' })).toBe('Cardio');
  });

  it('löst Mehrfach-Angaben nach Reihenfolge auf', () => {
    expect(muscleGroup({ muscle: 'Core/Rücken' })).toBe('Core');
    expect(muscleGroup({ muscle: 'Po/Rücken' })).toBe('Gesäß & Hüfte');
    expect(muscleGroup({ muscle: 'Po/Beine' })).toBe('Gesäß & Hüfte');
  });

  it('Cooldown-Einträge landen in der Dehnungs-Gruppe', () => {
    expect(muscleGroup({ muscle: 'Brust', phase: 'cooldown' })).toBe('Dehnung');
  });

  it('fällt auf Sonstige zurück', () => {
    expect(muscleGroup({ muscle: 'Etwas Unbekanntes' })).toBe('Sonstige');
    expect(muscleGroup(null)).toBe('Sonstige');
  });
});

describe('libraryEntries', () => {
  const entries = libraryEntries();

  it('enthält Haupt- und Cooldown-Übungen', () => {
    expect(entries.length).toBeGreaterThan(50);
    expect(entries.some((e) => e.phase === 'main')).toBe(true);
    expect(entries.some((e) => e.phase === 'cooldown')).toBe(true);
  });

  it('hat eindeutige Ids und Namen', () => {
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.name.toLowerCase())).size).toBe(entries.length);
  });

  it('jeder Eintrag ergibt eine schema-valide Übung', () => {
    for (const entry of entries) {
      const exercise = libraryEntryToExercise(entry);
      const plan = {
        schema_version: 1,
        name: 'P',
        days: [{ key: 'd', name: 'D', focus: '', exercises: [exercise] }],
      };
      const result = planSchema.safeParse(plan);
      if (!result.success) throw new Error(`${entry.id}: ${JSON.stringify(result.error.issues)}`);
    }
  });

  it('Zeit- und Cardio-Einträge haben eine Zieldauer, Kraft-Einträge Wiederholungen', () => {
    for (const entry of entries) {
      if (entry.type === 'time' || entry.type === 'cardio') expect(entry.target_seconds).toBeGreaterThan(0);
      else expect(entry.target_reps).toBeTruthy();
    }
  });

  it('liefert nur belegte Gruppen, Dehnung am Ende', () => {
    const groups = libraryGroups();
    expect(groups).toContain('Brust');
    expect(groups[groups.length - 1]).toBe('Dehnung');
  });
});

describe('searchLibrary', () => {
  it('findet über Name, Muskel und Technik-Hinweis', () => {
    expect(searchLibrary('plank').length).toBeGreaterThan(0);
    expect(searchLibrary('brust').length).toBeGreaterThan(0);
    expect(searchLibrary('', 'Cardio').every((e) => e.group === 'Cardio')).toBe(true);
  });

  it('kombiniert Suchtext und Gruppe', () => {
    const result = searchLibrary('dehnung', 'Dehnung');
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((e) => e.group === 'Dehnung')).toBe(true);
  });

  it('ignoriert Groß-/Kleinschreibung und Leerraum', () => {
    expect(searchLibrary('  PLANK  ').length).toBe(searchLibrary('plank').length);
  });

  it('gibt bei leerer Suche alles zurück', () => {
    expect(searchLibrary('').length).toBe(libraryEntries().length);
  });
});

describe('libraryEntryToExercise', () => {
  it('vergibt eindeutige Ids gegen bestehende', () => {
    const entry = libraryEntries()[0];
    const existing = new Set([entry.id]);
    expect(libraryEntryToExercise(entry, existing).id).not.toBe(entry.id);
  });

  it('setzt phase korrekt', () => {
    const stretch = libraryEntries().find((e) => e.phase === 'cooldown');
    const main = libraryEntries().find((e) => e.phase === 'main');
    expect(libraryEntryToExercise(stretch).phase).toBe('cooldown');
    expect(libraryEntryToExercise(main).phase).toBe('main');
  });

  it('übernimmt keine Bibliotheks-Zusatzfelder', () => {
    const exercise = libraryEntryToExercise(libraryEntries()[0]);
    expect(exercise.group).toBeUndefined();
  });
});

describe('demoSearchUrl', () => {
  it('nutzt video_query, sonst den Namen', () => {
    expect(demoSearchUrl({ video_query: 'bench press form' })).toContain('bench%20press%20form');
    expect(demoSearchUrl({ name: 'Goblet Squat', video_query: '' })).toContain('Goblet%20Squat%20Technik');
  });
});

// Invarianten der Übungsbibliothek (shared/exercises.json). Die Bibliothek
// speist Plan-Wizard, Picker und den Übungs-Tausch im Workout — deshalb muss
// jeder Eintrag Zonen, Gerät und Bewegungsmuster tragen und jede Zone genug
// Alternativen haben (auch ohne Gerät, für Training unterwegs).
describe('Bibliotheks-Invarianten', () => {
  const entries = libraryEntries();
  const main = entries.filter((e) => e.phase === 'main');

  it('jeder Eintrag hat gültige Zonen, Gerät und Bewegungsmuster', () => {
    for (const entry of entries) {
      expect(entry.zones?.primary?.length, `${entry.id}: primary zones`).toBeGreaterThan(0);
      for (const key of [...entry.zones.primary, ...(entry.zones.secondary ?? [])]) {
        expect(MUSCLE_ZONES, `${entry.id}: zone ${key}`).toContain(key);
      }
      expect(EQUIPMENT_KEYS, `${entry.id}: equipment`).toContain(entry.equipment);
      expect(PATTERN_KEYS, `${entry.id}: pattern ${entry.pattern}`).toContain(entry.pattern);
      expect(entry.cue?.length, `${entry.id}: cue`).toBeGreaterThan(10);
      expect(entry.video_query?.length, `${entry.id}: video_query`).toBeGreaterThan(3);
    }
  });

  it('Dehnungen sind mobility, Hauptübungen nicht', () => {
    for (const entry of entries) {
      if (entry.phase === 'cooldown') expect(entry.pattern, entry.id).toBe('mobility');
      else expect(entry.pattern, entry.id).not.toBe('mobility');
    }
  });

  // Hauptübungen benennen den Anteil (obere Brust, Latissimus, …) statt des
  // Dach-Keys. Ausnahme nur, wo keine Teilzone passt (Tibialis = Schienbein,
  // keine eigene Zone am Modell).
  const UMBRELLA_PRIMARY_ALLOWED = new Set(['tibialis-raise']);
  it('Hauptübungen nutzen Teilzonen statt Dach-Keys als primär', () => {
    const umbrellas = Object.keys(ZONE_CHILDREN);
    for (const entry of main) {
      if (UMBRELLA_PRIMARY_ALLOWED.has(entry.id)) continue;
      for (const key of entry.zones.primary) {
        expect(umbrellas, `${entry.id}: primary „${key}" → Teilzone nutzen`).not.toContain(key);
      }
    }
  });

  it('Aliase sind eindeutig und kollidieren nicht mit Namen', () => {
    const seen = new Map();
    for (const entry of entries) {
      const keys = [entry.name, ...(entry.aliases ?? [])].map((s) => s.toLowerCase().trim());
      for (const key of keys) {
        expect(seen.has(key) && seen.get(key) !== entry.id, `${key}: ${seen.get(key)} vs ${entry.id}`).toBe(false);
        seen.set(key, entry.id);
      }
    }
  });

  it('jede Teilzone hat mindestens 6 Hauptübungen und 3 davon mit Körpergewicht', () => {
    for (const zone of LEAF_ZONES) {
      const hits = main.filter((e) => e.zones.primary.includes(zone));
      const bodyweight = hits.filter((e) => e.equipment === 'koerpergewicht' || e.equipment === 'band');
      expect(hits.length, `${zone}: Hauptübungen`).toBeGreaterThanOrEqual(6);
      expect(bodyweight.length, `${zone}: Körpergewicht/Band-Alternativen`).toBeGreaterThanOrEqual(3);
    }
  });

  it('jedes Kraft-Bewegungsmuster hat mindestens 2 Übungen mit unterschiedlichem Gerät', () => {
    const skip = new Set(['mobility', 'cardio']);
    for (const pattern of PATTERN_KEYS) {
      if (skip.has(pattern)) continue;
      const hits = main.filter((e) => e.pattern === pattern);
      const equipment = new Set(hits.map((e) => e.equipment));
      expect(equipment.size, `${pattern}: Geräte-Varianten (${[...equipment].join(',')})`).toBeGreaterThanOrEqual(2);
    }
  });

  it('libraryEntryToExercise übernimmt das Bewegungsmuster', () => {
    const entry = main[0];
    expect(libraryEntryToExercise(entry).pattern).toBe(entry.pattern);
  });
});
