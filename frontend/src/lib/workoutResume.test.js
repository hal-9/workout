import { describe, it, expect, beforeEach } from 'vitest';
import { clearResumeState, loadResumeState, RESUME_MAX_AGE_MS, saveResumeState } from './workoutResume.js';

function storageStub() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

describe('workoutResume', () => {
  beforeEach(() => {
    globalThis.localStorage = storageStub();
  });

  it('gibt Fokus-Übung und laufende Pause zurück', () => {
    saveResumeState(7, { focusExerciseId: 'bp', rest: { targetTimestampMs: 5000, totalSeconds: 60 } }, 1000);
    expect(loadResumeState(7, 1000)).toEqual({
      focusExerciseId: 'bp',
      rest: { targetTimestampMs: 5000, totalSeconds: 60 },
    });
  });

  it('lässt abgelaufene Pausen weg, behält aber den Fokus', () => {
    saveResumeState(7, { focusExerciseId: 'bp', rest: { targetTimestampMs: 900 } }, 1000);
    expect(loadResumeState(7, 1000)).toEqual({ focusExerciseId: 'bp', rest: null });
  });

  it('gehört der Zustand zu einer anderen Session, bleibt er liegen', () => {
    saveResumeState(7, { focusExerciseId: 'bp' }, 1000);
    expect(loadResumeState(8, 1000)).toBeNull();
    expect(loadResumeState(null, 1000)).toBeNull();
  });

  it('verfällt nach zwölf Stunden und lässt sich löschen', () => {
    saveResumeState(7, { focusExerciseId: 'bp' }, 0);
    expect(loadResumeState(7, RESUME_MAX_AGE_MS + 1)).toBeNull();
    saveResumeState(7, { focusExerciseId: 'bp' }, 1000);
    clearResumeState();
    expect(loadResumeState(7, 1000)).toBeNull();
  });
});
