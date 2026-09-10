// Grobe Dauer-Schätzung für ein Workout, damit auf „Heute" steht, worauf man
// sich einlässt. Bewusst simpel: pro Arbeitssatz Ausführung + Pause, Cooldown
// mit seiner Haltezeit, dazu etwas Auf- und Abbau. Keine Historie, keine
// Hochrechnung — die Zahl wird als „ca." beschriftet.
export const SET_SECONDS = 45;
export const SET_REST_SECONDS = 60;
export const OVERHEAD_SECONDS = 180;

export function estimateWorkoutSeconds(mainExercises = [], cooldownExercises = []) {
  const sets = mainExercises.reduce((sum, ex) => sum + (ex.sets ?? 0), 0);
  if (!sets) return 0;
  const cooldown = cooldownExercises.reduce((sum, ex) => sum + (ex.target_seconds ?? 0), 0);
  return sets * (SET_SECONDS + SET_REST_SECONDS) + cooldown + OVERHEAD_SECONDS;
}

// Auf 5 Minuten gerundet — eine Schätzung auf die Minute wäre gelogen.
export function formatEstimate(seconds) {
  if (!seconds) return null;
  const minutes = Math.max(5, Math.round(seconds / 300) * 5);
  return `ca. ${minutes} Min.`;
}
