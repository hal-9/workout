import { describe, expect, it } from 'vitest';
import { applyBigNumber, plannedSetCount, sideLabel } from './setRows.js';

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

describe('unilateral', () => {
  it('verdoppelt die Satzzahl und wechselt links/rechts', () => {
    const ex = { sets: 3, unilateral: true };
    expect(plannedSetCount(ex)).toBe(6);
    expect([1, 2, 3].map((n) => sideLabel(ex, n))).toEqual(['links', 'rechts', 'links']);
    expect(plannedSetCount({ sets: 3 })).toBe(3);
    expect(sideLabel({ sets: 3 }, 1)).toBeNull();
  });
});
