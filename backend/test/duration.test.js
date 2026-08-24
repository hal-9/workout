import { describe, it, expect } from 'vitest';
import {
  durationUnitLabel,
  formatDuration,
  fromInputValue,
  toInputValue,
} from 'shared/duration';

describe('durationUnitLabel', () => {
  it('zeigt Minuten für Cardio und Sekunden für alles andere', () => {
    expect(durationUnitLabel('cardio')).toBe('Min.');
    expect(durationUnitLabel('time')).toBe('Sek.');
  });
});

describe('fromInputValue', () => {
  it('rechnet Cardio-Minuten in Sekunden um', () => {
    expect(fromInputValue('25', 'cardio')).toBe(1500);
    expect(fromInputValue('12.5', 'cardio')).toBe(750);
  });

  it('akzeptiert Komma als Dezimaltrennzeichen', () => {
    expect(fromInputValue('12,5', 'cardio')).toBe(750);
  });

  it('lässt Sekunden bei time-Übungen unverändert', () => {
    expect(fromInputValue('45', 'time')).toBe(45);
  });

  it('gibt null für leere oder ungültige Eingaben zurück', () => {
    expect(fromInputValue('', 'cardio')).toBeNull();
    expect(fromInputValue('0', 'cardio')).toBeNull();
    expect(fromInputValue('abc', 'time')).toBeNull();
    expect(fromInputValue(null, 'time')).toBeNull();
  });
});

describe('toInputValue', () => {
  it('rechnet Sekunden für Cardio in Minuten um', () => {
    expect(toInputValue(1500, 'cardio')).toBe('25');
    expect(toInputValue(750, 'cardio')).toBe('12.5');
  });

  it('lässt Sekunden bei time-Übungen unverändert', () => {
    expect(toInputValue(45, 'time')).toBe('45');
  });

  it('gibt leeren String ohne Wert zurück', () => {
    expect(toInputValue(null, 'cardio')).toBe('');
    expect(toInputValue('', 'time')).toBe('');
  });

  it('ist round-trip-stabil', () => {
    for (const seconds of [30, 45, 90, 600, 750, 1500]) {
      expect(fromInputValue(toInputValue(seconds, 'cardio'), 'cardio')).toBe(seconds);
      expect(fromInputValue(toInputValue(seconds, 'time'), 'time')).toBe(seconds);
    }
  });
});

describe('formatDuration', () => {
  it('formatiert menschenlesbar', () => {
    expect(formatDuration(45)).toBe('45 Sek');
    expect(formatDuration(60)).toBe('1 Min');
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(1500)).toBe('25 Min');
    expect(formatDuration(1530)).toBe('25:30');
  });

  it('gibt leeren String ohne Wert zurück', () => {
    expect(formatDuration(null)).toBe('');
  });
});
