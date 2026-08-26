import { beforeEach, describe, expect, it } from 'vitest';
import { applyWeekOrder, clearWeekOrder, hasWeekOrder, swapWorkout } from './weekOrder.js';
import { projectWeek } from './schedule.js';

const plan = {
  days: [
    { key: 'upper_a', name: 'Upper A', weekday: 'wed' },
    { key: 'lower_a', name: 'Lower A', weekday: 'thu' },
    { key: 'upper_b', name: 'Upper B', weekday: 'sat' },
    { key: 'lower_b', name: 'Lower B', weekday: 'sun' },
  ],
};

// Mittwoch als Referenz — Wochen-Key bleibt innerhalb des Tests stabil.
const wednesday = new Date(2026, 7, 26);

function storageStub() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

beforeEach(() => {
  globalThis.localStorage = storageStub();
});

describe('weekOrder', () => {
  it('is a no-op without a stored override', () => {
    expect(hasWeekOrder(wednesday)).toBe(false);
    expect(applyWeekOrder(plan, wednesday)).toBe(plan);
  });

  it('moves the swapped day before the first open day and keeps slot weekdays', () => {
    swapWorkout(plan, 'lower_a', new Set(), wednesday);
    const ordered = applyWeekOrder(plan, wednesday);
    expect(ordered.days.map((d) => d.key)).toEqual(['lower_a', 'upper_a', 'upper_b', 'lower_b']);
    // Slots (wed, thu, sat, sun) bleiben — nur die Belegung wechselt.
    expect(ordered.days.map((d) => d.weekday)).toEqual(['wed', 'thu', 'sat', 'sun']);
  });

  it('projects the swapped day onto today', () => {
    swapWorkout(plan, 'lower_a', new Set(), wednesday);
    const ordered = applyWeekOrder(plan, wednesday);
    const projection = projectWeek(ordered, new Map(), wednesday);
    expect(projection.nextKey).toBe('lower_a');
    const entry = projection.days.find((d) => d.key === 'lower_a');
    expect(entry.projectedIdx).toBe(2); // Mittwoch
  });

  it('keeps done days in front of the swapped day', () => {
    swapWorkout(plan, 'upper_b', new Set(['upper_a']), wednesday);
    const ordered = applyWeekOrder(plan, wednesday);
    expect(ordered.days.map((d) => d.key)).toEqual(['upper_a', 'upper_b', 'lower_a', 'lower_b']);
  });

  it('expires with the week and can be cleared', () => {
    swapWorkout(plan, 'lower_a', new Set(), wednesday);
    expect(hasWeekOrder(wednesday)).toBe(true);
    const nextMonday = new Date(2026, 7, 31);
    expect(hasWeekOrder(nextMonday)).toBe(false);
    expect(applyWeekOrder(plan, nextMonday)).toBe(plan);
    clearWeekOrder();
    expect(hasWeekOrder(wednesday)).toBe(false);
  });
});
