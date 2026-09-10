// Ein unterbrochener Plan-Umbau soll nicht verloren gehen: der Entwurf liegt
// im localStorage und wird beim nächsten Öffnen angeboten. Nur ein Slot —
// mehr als einen Plan bearbeitet niemand gleichzeitig.
const STORAGE_KEY = 'lilief-plan-draft';
export const DRAFT_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

export function saveDraft(plan, now = Date.now()) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ saved_at: now, plan }));
  } catch {
    /* voller oder gesperrter Speicher: der Entwurf ist ein Bonus, kein Muss */
  }
}

export function loadDraft(now = Date.now()) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.plan?.days?.length) return null;
    if (!parsed.saved_at || now - parsed.saved_at > DRAFT_MAX_AGE_MS) {
      clearDraft();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* siehe saveDraft */
  }
}
