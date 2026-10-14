import { DEFAULT_WEIGHT_STEP, roundDownToStep, weightStep } from 'shared/equipment';
import { isCooldownExercise } from './cooldown.js';

// Leichte Version bei niedriger Tagesform: −1 Satz (min. 1), bei
// Gewichtsübungen −10 %, abgerundet auf den Gewichtsschritt des Geräts —
// 10 kg Kurzhanteln werden 7,5 kg, nie erfundene 9 kg. Ist schon der
// kleinste Schritt erreicht, bleibt das Gewicht. Cooldown bleibt unverändert.
export function lightWeight(kg, step = DEFAULT_WEIGHT_STEP) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return kg;
  return roundDownToStep(n * 0.9, step) || n;
}

export function lightenExercise(exercise) {
  if (isCooldownExercise(exercise)) return exercise;
  const lightened = { ...exercise, sets: Math.max(1, (exercise.sets ?? 1) - 1) };
  if (exercise.type === 'wt' && exercise.default_weight_kg != null) {
    lightened.default_weight_kg = lightWeight(exercise.default_weight_kg, weightStep(exercise));
  }
  return lightened;
}
