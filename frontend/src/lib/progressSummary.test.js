import { describe, it, expect } from 'vitest';
import { biggestGain, buildProgressSummary } from './progressSummary.js';

const recap = { weeks: [{}, {}, {}, {}], averageDone: 2.5, streak: 3, total: 3 };
const exercises = [
  { exercise_id: 'bp', name: 'Bankdrücken', first_value: 100, latest_value: 105, metric_label: 'kg', sessions_count: 6 },
  { exercise_id: 'cu', name: 'Curls', first_value: 20, latest_value: 25, metric_label: 'kg', sessions_count: 4 },
  { exercise_id: 'row', name: 'Rudern', first_value: 40, latest_value: 30, metric_label: 'kg', sessions_count: 5 },
];
const proposals = [{ exercise_id: 'bp', name: 'Bankdrücken', field: 'default_weight_kg', from: 100, to: 102.5 }];

describe('biggestGain', () => {
  it('vergleicht relativ, nicht absolut', () => {
    expect(biggestGain(exercises).exercise.exercise_id).toBe('cu');
  });

  it('ignoriert Rückschritte, Einzelmessungen und fehlende Werte', () => {
    expect(biggestGain([exercises[2]])).toBeNull();
    expect(biggestGain([{ ...exercises[1], sessions_count: 1 }])).toBeNull();
    expect(biggestGain([{ name: 'x', first_value: null, latest_value: 30, sessions_count: 4 }])).toBeNull();
    expect(biggestGain([])).toBeNull();
  });
});

describe('buildProgressSummary', () => {
  it('liefert Konsistenz, Zuwachs und nächsten Schritt', () => {
    const items = buildProgressSummary({ weekRecap: recap, exercises, proposals });
    expect(items.map((i) => i.key)).toEqual(['consistency', 'strength', 'milestone']);
    expect(items[0]).toMatchObject({ value: '2.5/3', detail: 'Serie: 3 Wochen' });
    expect(items[1]).toMatchObject({ value: '+25 %', detail: 'Curls: 20 → 25 kg' });
    expect(items[2].detail).toBe('Bankdrücken');
  });

  it('nennt ohne Serie das Wochenziel', () => {
    const [consistency] = buildProgressSummary({ weekRecap: { ...recap, streak: 0 } });
    expect(consistency.detail).toBe('Ziel: 3 pro Woche');
  });

  it('lässt weg, wofür es keine Daten gibt', () => {
    expect(buildProgressSummary({})).toEqual([]);
    expect(buildProgressSummary({ exercises: [exercises[2]] })).toEqual([]);
  });
});
