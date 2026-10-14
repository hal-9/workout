import { findLibraryEntry } from './library.js';

// Sinnvoller Gewichtsschritt je Gerät — gilt für Stepper, Progression und
// leichte Version, damit nirgends ein Gewicht entsteht, das es nicht gibt
// (z. B. 9 kg bei Kurzhanteln). Ohne Gerät: 2,5 kg.
export const DEFAULT_WEIGHT_STEP = 2.5;

const STEP_BY_EQUIPMENT = {
  kurzhantel: 2.5,
  langhantel: 2.5,
  kabelzug: 2.5,
  maschine: 5,
  kettlebell: 4,
};

export function equipmentOf(exercise) {
  return exercise?.equipment ?? findLibraryEntry(exercise)?.equipment ?? null;
}

export function weightStep(exercise) {
  return STEP_BY_EQUIPMENT[equipmentOf(exercise)] ?? DEFAULT_WEIGHT_STEP;
}

// Schlüssel für „Gewicht nicht vorhanden": pro Gerät (12,5-kg-Kurzhanteln
// fehlen für alle Kurzhantel-Übungen), ohne bekanntes Gerät pro Übung.
export function equipmentKey(exercise) {
  return equipmentOf(exercise) ?? `exercise:${exercise?.id}`;
}

// Auf den Schritt abrunden — für Abzüge wie die leichte Version.
export function roundDownToStep(kg, step) {
  return Math.round(Math.floor(kg / step + 1e-9) * step * 100) / 100;
}
