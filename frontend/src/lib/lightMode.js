import { isCooldownExercise } from './cooldown.js';

// Leichte Version bei niedriger Tagesform: −1 Satz (min. 1),
// bei Gewichtsübungen −10 % auf 0,5 kg gerundet. Cooldown bleibt unverändert.
export function lightWeight(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return kg;
  return Math.round(n * 0.9 * 2) / 2;
}

export function lightenExercise(exercise) {
  if (isCooldownExercise(exercise)) return exercise;
  const lightened = { ...exercise, sets: Math.max(1, (exercise.sets ?? 1) - 1) };
  if (exercise.type === 'wt' && exercise.default_weight_kg != null) {
    lightened.default_weight_kg = lightWeight(exercise.default_weight_kg);
  }
  return lightened;
}
