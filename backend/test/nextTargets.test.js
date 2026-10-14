import { describe, it, expect } from 'vitest';
import { nextTargets } from 'shared/nextTargets';

const row = (set_number, reps, weight_kg = 10) => ({ set_number, reps, weight_kg, duration_s: null });
const rudern = { id: 'row', type: 'wt', sets: 3, target_reps: '8-15', default_weight_kg: 10 };

describe('nextTargets', () => {
  it('übernimmt das letzte Mal exakt: 15 Wdh. mit 10 kg bleibt 15 mit 10 kg', () => {
    expect(nextTargets([row(1, 15)], rudern, rudern)).toEqual([row(1, 15)]);
  });

  it('übernimmt pro Satz, nicht den besten Satz für alle', () => {
    const last = [row(1, 15), row(2, 13), row(3, 12)];
    expect(nextTargets(last, rudern, rudern).map((r) => r.reps)).toEqual([15, 13, 12]);
  });

  it('ohne Plan-Stand des letzten Workouts: nur übernehmen', () => {
    expect(nextTargets([row(1, 12)], rudern, null)).toEqual([row(1, 12)]);
  });

  it('übernommenes Mehrgewicht gilt einmal, Wdh. starten unten im Bereich', () => {
    const now = { ...rudern, default_weight_kg: 12.5 };
    const out = nextTargets([row(1, 15), row(2, 15)], now, rudern);
    expect(out.map((r) => [r.weight_kg, r.reps])).toEqual([[12.5, 8], [12.5, 8]]);
  });

  it('weniger Gewicht im Plan behält die Wdh.', () => {
    const now = { ...rudern, default_weight_kg: 7.5 };
    expect(nextTargets([row(1, 15)], now, rudern)[0]).toMatchObject({ weight_kg: 7.5, reps: 15 });
  });

  it('höherer Wdh.-Bereich: +1 im schwächsten Satz, bei Gleichstand im früheren', () => {
    const now = { ...rudern, target_reps: '8-16' };
    expect(nextTargets([row(1, 15), row(2, 15), row(3, 15)], now, rudern).map((r) => r.reps)).toEqual([16, 15, 15]);
    expect(nextTargets([row(1, 15), row(2, 13), row(3, 13)], now, rudern).map((r) => r.reps)).toEqual([15, 14, 13]);
  });

  it('einseitig: +1 je Seite, Seiten bleiben unabhängig', () => {
    const then = { ...rudern, unilateral: true };
    const now = { ...then, target_reps: '8-16' };
    const last = [row(1, 12), row(2, 10), row(3, 12), row(4, 11)];
    expect(nextTargets(last, now, then).map((r) => r.reps)).toEqual([13, 11, 12, 11]);
  });

  it('längere Zieldauer hebt kürzere Sätze an', () => {
    const plank = { id: 'plank', type: 'time', sets: 2, target_seconds: 45 };
    const last = [{ set_number: 1, duration_s: 50 }, { set_number: 2, duration_s: 40 }];
    expect(nextTargets(last, { ...plank, target_seconds: 55 }, plank).map((r) => r.duration_s)).toEqual([55, 55]);
  });

  it('verändert die Eingabe nicht', () => {
    const last = [row(1, 15)];
    nextTargets(last, { ...rudern, default_weight_kg: 12.5 }, rudern);
    expect(last).toEqual([row(1, 15)]);
  });
});
