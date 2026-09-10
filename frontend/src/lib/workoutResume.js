// App mitten im Workout geschlossen und wieder geöffnet: Sätze kommen vom
// Server, Fokus-Übung und Pausen-Timer lagen bisher nur im Komponenten-State.
// Beides liegt jetzt hier — an die Session gebunden, damit nichts aus einer
// alten Session zurückkommt.
const STORAGE_KEY = 'lilief-workout-resume';
export const RESUME_MAX_AGE_MS = 12 * 3600 * 1000;

export function saveResumeState(sessionId, state, now = Date.now()) {
  if (!sessionId) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ session_id: sessionId, saved_at: now, ...state }));
  } catch {
    /* voller Speicher: Fortsetzen ist Komfort */
  }
}

export function loadResumeState(sessionId, now = Date.now()) {
  if (!sessionId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.session_id !== sessionId) return null;
    if (!parsed.saved_at || now - parsed.saved_at > RESUME_MAX_AGE_MS) {
      clearResumeState();
      return null;
    }
    // Abgelaufene Pause nicht wiederbeleben — der Timer läuft in echter Zeit.
    const rest = parsed.rest && parsed.rest.targetTimestampMs > now ? parsed.rest : null;
    return { focusExerciseId: parsed.focusExerciseId ?? null, rest };
  } catch {
    return null;
  }
}

export function clearResumeState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* siehe saveResumeState */
  }
}
