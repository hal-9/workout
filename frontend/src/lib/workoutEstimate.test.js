import { describe, it, expect } from 'vitest';
import { estimateWorkoutSeconds, formatEstimate } from './workoutEstimate.js';

describe('estimateWorkoutSeconds', () => {
  it('rechnet Sätze mit Pause plus Auf-/Abbau', () => {
    // 6 Sätze × 105 s + 180 s
    expect(estimateWorkoutSeconds([{ sets: 3 }, { sets: 3 }])).toBe(810);
  });

  it('zählt Cooldown mit seiner Haltezeit', () => {
    expect(estimateWorkoutSeconds([{ sets: 1 }], [{ target_seconds: 60 }, { target_seconds: 30 }])).toBe(375);
  });

  it('ohne Sätze gibt es keine Schätzung', () => {
    expect(estimateWorkoutSeconds([], [{ target_seconds: 60 }])).toBe(0);
    expect(estimateWorkoutSeconds()).toBe(0);
  });
});

describe('formatEstimate', () => {
  it('rundet auf 5 Minuten', () => {
    expect(formatEstimate(810)).toBe('ca. 15 Min.');
    expect(formatEstimate(2700)).toBe('ca. 45 Min.');
  });

  it('bleibt bei mindestens 5 Minuten und liefert ohne Dauer nichts', () => {
    expect(formatEstimate(30)).toBe('ca. 5 Min.');
    expect(formatEstimate(0)).toBeNull();
  });
});
