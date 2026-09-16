import { describe, it, expect } from 'vitest';
import { describeHint, formatHintValue, hintKey, isApplicable, trendView } from './coachSummary.js';

describe('coachSummary', () => {
  it('formatiert Zielwerte je Feld', () => {
    expect(formatHintValue('weight_kg', 42.5)).toBe('42,5 kg');
    expect(formatHintValue('weight_kg', 40)).toBe('40 kg');
    expect(formatHintValue('reps', 12)).toBe('12 Wdh.');
    expect(formatHintValue('duration_s', 90)).toBe('1:30');
    expect(formatHintValue('reps', null)).toBe('');
  });

  it('übernehmbar nur mit Übung, Feld und Zahl', () => {
    expect(isApplicable({ text: 'x', exercise_id: 'bp', field: 'weight_kg', value: 42.5 })).toBe(true);
    expect(isApplicable({ text: 'Mehr schlafen' })).toBe(false);
    expect(isApplicable({ text: 'x', exercise_id: 'bp', field: 'weight_kg' })).toBe(false);
    expect(hintKey({ exercise_id: 'bp', field: 'weight_kg' })).toBe('bp:weight_kg');
  });

  it('unbekannter Trend fällt auf flat zurück', () => {
    expect(trendView('up').symbol).toBe('↑');
    expect(trendView('weird')).toEqual(trendView('flat'));
  });

  it('beschreibt Tipps für die Übungskarte', () => {
    expect(describeHint({ weight_kg: 42.5, reps: 10 })).toBe('Coach: 42,5 kg · 10 Wdh.');
    expect(describeHint({ duration_s: 60 })).toBe('Coach: 1 Min');
    expect(describeHint({})).toBeNull();
    expect(describeHint(null)).toBeNull();
  });
});
