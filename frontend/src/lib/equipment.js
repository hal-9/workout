import { findLibraryEntry } from 'shared/library';

// Gewichtsschritt nach Equipment: Kurzhanteln gehen in 1-kg-Paaren, Maschinen
// haben meist 5-kg-Platten. Ohne Bibliothekstreffer bleibt es bei 2.5.
export const DEFAULT_WEIGHT_STEP = 2.5;

const STEP_BY_EQUIPMENT = {
  kurzhantel: 1,
  langhantel: 2.5,
  kabelzug: 2.5,
  maschine: 5,
  kettlebell: 4,
};

export function stepForExercise(exercise) {
  const equipment = exercise?.equipment ?? findLibraryEntry(exercise)?.equipment;
  return STEP_BY_EQUIPMENT[equipment] ?? DEFAULT_WEIGHT_STEP;
}

const LABEL_BY_EQUIPMENT = {
  koerpergewicht: 'Körpergewicht',
  kurzhantel: 'Kurzhantel',
  langhantel: 'Langhantel',
  kabelzug: 'Kabelzug',
  maschine: 'Maschine',
  band: 'Band',
  klimmzugstange: 'Klimmzugstange',
  kettlebell: 'Kettlebell',
  cardio: 'Cardio',
};

export function equipmentLabel(exercise) {
  const equipment = exercise?.equipment ?? findLibraryEntry(exercise)?.equipment;
  return LABEL_BY_EQUIPMENT[equipment] ?? null;
}
