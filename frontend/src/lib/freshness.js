import { exerciseZones } from 'shared/muscles';
import { isCooldownExercise } from './cooldown.js';
import { parseUtc } from './dates.js';

// Muskel-Frische: Stunden seit letztem Training pro Zone, rein abgeleitet.
// Mapping über den aktiven Plan (day_key → Übungen → Zonen); Sessions älterer
// Pläne mit fremden day_keys fallen still raus. Sekundärzonen zählen halb
// belastet (Stunden verdoppelt). Ab FRESHNESS_WINDOW_HOURS gilt "erholt".
export const FRESHNESS_WINDOW_HOURS = 72;

export function buildFreshness(plan, sessions, now = new Date()) {
  if (!plan?.days?.length || !sessions?.length) return {};
  const dayByKey = new Map(plan.days.map((d) => [d.key, d]));
  const heat = {};

  function bump(zone, hours) {
    if (hours >= FRESHNESS_WINDOW_HOURS) return;
    if (heat[zone] == null || hours < heat[zone]) heat[zone] = hours;
  }

  for (const s of sessions) {
    if (!s.finished_at) continue;
    const hours = (now.getTime() - parseUtc(s.finished_at).getTime()) / 3600000;
    if (hours < 0 || hours >= FRESHNESS_WINDOW_HOURS) continue;
    const day = dayByKey.get(s.day_key);
    if (!day) continue;
    for (const ex of day.exercises ?? []) {
      if (isCooldownExercise(ex)) continue;
      const zones = exerciseZones(ex);
      for (const z of zones.primary) bump(z, hours);
      for (const z of zones.secondary) bump(z, hours * 2);
    }
  }
  return heat;
}
