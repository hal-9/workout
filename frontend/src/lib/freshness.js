// Import mit Nebenwirkung: registriert die Bibliothek als Zonen-Fallback für
// exerciseZones — getauschte Übungen stehen in keinem Plan.
import 'shared/library';
import { exerciseZones, expandZones } from 'shared/muscles';
import { isCooldownExercise } from './cooldown.js';
import { parseUtc } from './dates.js';

// Trainingslast pro Zone: Stunden seit dem letzten Satz, der diese Zone
// belastet hat. Grundlage sind die tatsächlich geloggten Übungen der Session
// (`session.exercises`) — nicht der Plan. Getauschte Übungen, abgebrochene
// Sessions und später geänderte Pläne bleiben damit korrekt abgebildet.
// Sekundärzonen zählen halb belastet (Stunden verdoppelt). Ab
// FRESHNESS_WINDOW_HOURS gilt "erholt".
export const FRESHNESS_WINDOW_HOURS = 72;

export function buildFreshness(sessions, now = new Date()) {
  if (!sessions?.length) return {};
  const heat = {};

  function bump(zone, hours) {
    if (hours >= FRESHNESS_WINDOW_HOURS) return;
    if (heat[zone] == null || hours < heat[zone]) heat[zone] = hours;
  }

  for (const s of sessions) {
    if (!s.finished_at) continue;
    const hours = (now.getTime() - parseUtc(s.finished_at).getTime()) / 3600000;
    if (hours < 0 || hours >= FRESHNESS_WINDOW_HOURS) continue;
    for (const ex of s.exercises ?? []) {
      if (isCooldownExercise(ex)) continue;
      const zones = exerciseZones(ex);
      for (const z of expandZones(zones.primary)) bump(z, hours);
      for (const z of expandZones(zones.secondary)) bump(z, hours * 2);
    }
  }
  return heat;
}
