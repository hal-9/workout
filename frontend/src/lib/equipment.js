import { equipmentOf } from 'shared/equipment';

export { DEFAULT_WEIGHT_STEP, weightStep as stepForExercise } from 'shared/equipment';

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
  return LABEL_BY_EQUIPMENT[equipmentOf(exercise)] ?? null;
}

// „Goblet Squat (Kettlebell)" → Titel + Variante. Viele Planübungen tragen das
// Gerät schon im Namen; ohne Split stünde es doppelt da.
export function splitExerciseName(name) {
  const match = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(name ?? '');
  return match ? { base: match[1], variant: match[2] } : { base: name ?? '', variant: null };
}
