import { describe, expect, it } from 'vitest';
import { applyBigNumber, withCoachHint } from './setRows.js';

const row = (reps, logged = false) => ({ reps, weight_kg: '', duration: '', logged });

describe('applyBigNumber', () => {
  it('überträgt die neue Zahl auf folgende offene Sätze mit gleichem Wert', () => {
    const rows = [row('3'), row('3'), row('3')];
    const out = applyBigNumber(rows, 0, 'reps', () => 5);
    expect(out.map((r) => r.reps)).toEqual(['5', '5', '5']);
  });

  it('lässt einzeln abweichende Sätze in Ruhe', () => {
    const rows = [row('3'), row('4'), row('3')];
    const out = applyBigNumber(rows, 0, 'reps', (n) => n + 2);
    expect(out.map((r) => r.reps)).toEqual(['5', '4', '5']);
  });

  it('ändert weder erledigte noch vorherige Sätze', () => {
    const rows = [row('3', true), row('3'), row('3', true), row('3')];
    const out = applyBigNumber(rows, 1, 'reps', () => 5);
    expect(out.map((r) => r.reps)).toEqual(['3', '5', '3', '5']);
    expect(out[0]).toBe(rows[0]);
  });

  it('arbeitet mit dem Dauer-Feld und klemmt bei 0', () => {
    const rows = [{ duration: '30', logged: false }, { duration: '30', logged: false }];
    expect(applyBigNumber(rows, 0, 'duration', (n) => n + 10).map((r) => r.duration)).toEqual(['40', '40']);
    expect(applyBigNumber(rows, 1, 'duration', (n) => n - 50)[1].duration).toBe('0');
  });

  it('behandelt leere Sätze wie den Plan-Zielwert (erstes Workout ohne Historie)', () => {
    const rows = [row(''), row(''), row('8')];
    const out = applyBigNumber(rows, 0, 'reps', (n) => n + 2, '3');
    expect(out.map((r) => r.reps)).toEqual(['5', '5', '8']);
  });

  it('ohne Zielwert zählen leere Sätze als 0', () => {
    const rows = [row(''), row(''), row('8')];
    const out = applyBigNumber(rows, 0, 'reps', () => 5);
    expect(out.map((r) => r.reps)).toEqual(['5', '5', '8']);
  });
});

describe('withCoachHint', () => {
  const row = { set_number: 1, reps: 8, weight_kg: 40, duration: '', logged: false };

  it('ersetzt Gewicht, Wiederholungen oder Dauer aus dem Tipp', () => {
    expect(withCoachHint(row, { weight_kg: 42.5 })).toMatchObject({ weight_kg: 42.5, reps: 8 });
    expect(withCoachHint(row, { reps: 10 })).toMatchObject({ weight_kg: 40, reps: 10 });
    expect(withCoachHint(row, { duration_s: 45 })).toMatchObject({ duration: '45' });
  });

  it('lässt geloggte Sätze und Sätze ohne Tipp unangetastet', () => {
    expect(withCoachHint({ ...row, logged: true }, { weight_kg: 42.5 })).toEqual({ ...row, logged: true });
    expect(withCoachHint(row, null)).toBe(row);
  });
});
