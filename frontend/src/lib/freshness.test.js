import { describe, it, expect } from 'vitest';
import { buildFreshness, FRESHNESS_WINDOW_HOURS } from './freshness.js';

function sqlUtcHoursAgo(now, hours) {
  const d = new Date(now.getTime() - hours * 3600000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const NOW = new Date('2026-08-26T12:00:00Z');

const plan = {
  days: [
    {
      key: 'push',
      exercises: [
        { id: 'bp', name: 'Bankdrücken', type: 'wt', zones: { primary: ['brust'], secondary: ['trizeps'] } },
        { id: 'st', name: 'Brust-Dehnung', type: 'time', phase: 'cooldown', zones: { primary: ['brust'], secondary: [] } },
      ],
    },
    {
      key: 'legs',
      exercises: [{ id: 'sq', name: 'Kniebeuge', type: 'wt', zones: { primary: ['quads'], secondary: ['gesaess'] } }],
    },
  ],
};

describe('buildFreshness', () => {
  it('mappt Sessions über day_key auf Zonen, Sekundär zählt halb', () => {
    const sessions = [{ day_key: 'push', finished_at: sqlUtcHoursAgo(NOW, 10) }];
    const heat = buildFreshness(plan, sessions, NOW);
    expect(heat.brust).toBeCloseTo(10, 3);
    expect(heat.trizeps).toBeCloseTo(20, 3);
    expect(heat.quads).toBeUndefined();
  });

  it('jüngste Session gewinnt pro Zone', () => {
    const sessions = [
      { day_key: 'push', finished_at: sqlUtcHoursAgo(NOW, 60) },
      { day_key: 'push', finished_at: sqlUtcHoursAgo(NOW, 10) },
    ];
    const heat = buildFreshness(plan, sessions, NOW);
    expect(heat.brust).toBeCloseTo(10, 3);
  });

  it('älter als Fenster gilt als erholt, auch für Sekundärzonen', () => {
    const sessions = [
      { day_key: 'legs', finished_at: sqlUtcHoursAgo(NOW, FRESHNESS_WINDOW_HOURS + 1) },
      { day_key: 'push', finished_at: sqlUtcHoursAgo(NOW, 40) },
    ];
    const heat = buildFreshness(plan, sessions, NOW);
    expect(heat.quads).toBeUndefined();
    expect(heat.brust).toBeCloseTo(40, 3);
    // Sekundär 40 h × 2 = 80 h ≥ 72 → raus
    expect(heat.trizeps).toBeUndefined();
  });

  it('unbekannte day_keys und leere Eingaben fallen still raus', () => {
    expect(buildFreshness(plan, [{ day_key: 'alt', finished_at: sqlUtcHoursAgo(NOW, 5) }], NOW)).toEqual({});
    expect(buildFreshness(null, [], NOW)).toEqual({});
  });
});
