import { describe, expect, it } from 'vitest';
import { projectWeek, weekProgress } from './schedule.js';

// Feste Woche: Mo 2026-08-24 … So 2026-08-30 (lokale Zeit)
const MON = new Date(2026, 7, 24);
function day(offset) {
  return new Date(2026, 7, 24 + offset);
}

const plan4 = {
  days: [
    { key: 'd1', name: 'Push' },
    { key: 'd2', name: 'Pull' },
    { key: 'd3', name: 'Legs' },
    { key: 'd4', name: 'Core' },
  ],
};
// Default-Spread für 4 Tage: Mo(0), Di(1), Do(3), Fr(4)

function idxByKey(result) {
  return Object.fromEntries(result.days.map((e) => [e.key, e.projectedIdx]));
}

describe('projectWeek', () => {
  it('liegt bei leerer Woche exakt auf dem Seed-Muster', () => {
    const r = projectWeek(plan4, new Map(), MON);
    expect(idxByKey(r)).toEqual({ d1: 0, d2: 1, d3: 3, d4: 4 });
    expect(r.nextKey).toBe('d1');
    expect(r.todayEntry?.key).toBe('d1');
  });

  it('verschiebt bei verpasstem Montag die Sequenz mit erhaltenen Abständen', () => {
    // Di, nichts erledigt: Mo→Di, Abstände 1,2,1 bleiben → Di, Mi, Fr, Sa
    const r = projectWeek(plan4, new Map(), day(1));
    expect(idxByKey(r)).toEqual({ d1: 1, d2: 2, d3: 4, d4: 5 });
  });

  it('zieht bei frühem Training nichts nach vorn (slip-only)', () => {
    // d1 am Mo erledigt, heute Di → d2 bleibt auf Seed Di?? nein, heute ist Di: d2 = Di (Seed).
    // Aussagekräftiger: heute Mi, d1+d2 erledigt → d3 bleibt Do (Seed), rutscht nicht auf Mi.
    const done = new Map([
      ['d1', day(0)],
      ['d2', day(1)],
    ]);
    const r = projectWeek(plan4, done, day(2));
    expect(idxByKey(r).d3).toBe(3);
    expect(idxByKey(r).d4).toBe(4);
    expect(r.todayEntry).toBeNull();
  });

  it('erlaubt nie zwei Workouts am selben Tag', () => {
    // d1 heute (Di) nachgeholt → d2 frühestens Mi
    const done = new Map([['d1', day(1)]]);
    const r = projectWeek(plan4, done, day(1));
    expect(r.trainedToday).toBe(true);
    expect(idxByKey(r).d2).toBe(2);
  });

  it('erhält Pausen nach spät erledigtem Workout (Kette ab Ist-Datum)', () => {
    // 2-Tage-Plan Mo/Do (Abstand 3); d1 erst Mi erledigt → d2 = max(Do, Mi+3=Sa) = Sa
    const plan2 = { days: [{ key: 'a', name: 'A' }, { key: 'b', name: 'B' }] };
    const done = new Map([['a', day(2)]]);
    const r = projectWeek(plan2, done, day(3));
    expect(idxByKey(r).b).toBe(5);
  });

  it('schrumpft Abstände am Wochenende, wenn die Woche sonst nicht reicht', () => {
    // Fr, nichts erledigt: 4 offen, 3 Tage übrig → Fr, Sa, So + d4 unplatzierbar
    const r = projectWeek(plan4, new Map(), day(4));
    expect(idxByKey(r)).toEqual({ d1: 4, d2: 5, d3: 6, d4: null });
    expect(r.days.find((e) => e.key === 'd4').unplaced).toBe(true);
  });

  it('lässt bei echtem Überlauf die letzten Tage der Sequenz fallen', () => {
    // So, nichts erledigt: nur d1 passt noch
    const r = projectWeek(plan4, new Map(), day(6));
    expect(idxByKey(r)).toEqual({ d1: 6, d2: null, d3: null, d4: null });
  });

  it('behält bei Erledigung außer der Reihe die Plan-Reihenfolge', () => {
    // d2 am Mo erledigt (per Chip), heute Di → nächster ist d1, dann d3/d4 mit Seeds
    const done = new Map([['d2', day(0)]]);
    const r = projectWeek(plan4, done, day(1));
    expect(r.nextKey).toBe('d1');
    expect(idxByKey(r).d1).toBe(1);
    expect(idxByKey(r).d3).toBe(3);
    expect(idxByKey(r).d4).toBe(4);
  });

  it('nutzt explizite Ziel-Wochentage als Seed-Muster', () => {
    const plan = {
      days: [
        { key: 'a', name: 'A', weekday: 'tue' },
        { key: 'b', name: 'B', weekday: 'sat' },
      ],
    };
    // Mi: A verpasst → Mi; B rückt mit erhaltenem Abstand (Di→Sa = 4) auf So
    const r = projectWeek(plan, new Map(), day(2));
    expect(idxByKey(r)).toEqual({ a: 2, b: 6 });
  });

  it('liefert für leeren Plan ein leeres Ergebnis', () => {
    expect(projectWeek(null, new Map(), MON).days).toEqual([]);
    expect(projectWeek({ days: [] }, new Map(), MON).nextKey).toBeUndefined();
  });
});

describe('weekProgress', () => {
  it('zählt erledigte Plan-Tage', () => {
    const done = new Map([['d1', day(0)]]);
    expect(weekProgress(plan4, done)).toEqual({ done: 1, total: 4 });
  });
});
