import { describe, it, expect } from 'vitest';
import { buildFreshness, FRESHNESS_WINDOW_HOURS } from './freshness.js';

function sqlUtcHoursAgo(now, hours) {
  const d = new Date(now.getTime() - hours * 3600000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const NOW = new Date('2026-08-26T12:00:00Z');

const bench = { id: 'bp', name: 'Bankdrücken', type: 'wt', zones: { primary: ['brust'], secondary: ['trizeps'] }, sets: 3 };
const stretch = { id: 'st', name: 'Brust-Dehnung', type: 'time', phase: 'cooldown', zones: { primary: ['brust'], secondary: [] }, sets: 1 };
const squat = { id: 'sq', name: 'Kniebeuge', type: 'wt', zones: { primary: ['quads'], secondary: ['gesaess'] }, sets: 3 };

describe('buildFreshness', () => {
  it('leitet Zonen aus den geloggten Übungen ab, Sekundär zählt halb', () => {
    const sessions = [{ finished_at: sqlUtcHoursAgo(NOW, 10), exercises: [bench, stretch] }];
    const heat = buildFreshness(sessions, NOW);
    // Dach-Zone „brust" färbt alle drei Brust-Teilzonen
    expect(heat.brust).toBeUndefined();
    expect(heat.brust_oben).toBeCloseTo(10, 3);
    expect(heat.brust_mitte).toBeCloseTo(10, 3);
    expect(heat.brust_unten).toBeCloseTo(10, 3);
    expect(heat.trizeps).toBeCloseTo(20, 3);
    expect(heat.quads).toBeUndefined();
  });

  it('jüngste Session gewinnt pro Zone', () => {
    const sessions = [
      { finished_at: sqlUtcHoursAgo(NOW, 60), exercises: [bench] },
      { finished_at: sqlUtcHoursAgo(NOW, 10), exercises: [bench] },
    ];
    expect(buildFreshness(sessions, NOW).brust_mitte).toBeCloseTo(10, 3);
  });

  it('älter als Fenster gilt als erholt, auch für Sekundärzonen', () => {
    const sessions = [
      { finished_at: sqlUtcHoursAgo(NOW, FRESHNESS_WINDOW_HOURS + 1), exercises: [squat] },
      { finished_at: sqlUtcHoursAgo(NOW, 40), exercises: [bench] },
    ];
    const heat = buildFreshness(sessions, NOW);
    expect(heat.quads).toBeUndefined();
    expect(heat.brust_mitte).toBeCloseTo(40, 3);
    // Sekundär 40 h × 2 = 80 h ≥ 72 → raus
    expect(heat.trizeps).toBeUndefined();
  });

  it('zählt nur geloggte Übungen — eine abgebrochene Session färbt den Rest nicht', () => {
    const sessions = [{ finished_at: sqlUtcHoursAgo(NOW, 5), exercises: [bench] }];
    const heat = buildFreshness(sessions, NOW);
    expect(heat.brust_mitte).toBeCloseTo(5, 3);
    expect(heat.quads).toBeUndefined();
    expect(heat.gesaess_gross).toBeUndefined();
  });

  it('getauschte Übung ohne Plan-Zonen kommt über die Bibliothek', () => {
    const sessions = [
      { finished_at: sqlUtcHoursAgo(NOW, 6), exercises: [{ id: 'hack-squat', name: 'Hackenschmidt-Kniebeuge (Maschine)', sets: 3 }] },
    ];
    const heat = buildFreshness(sessions, NOW);
    expect(heat.quads).toBeCloseTo(6, 3);
    expect(heat.gesaess_gross).toBeCloseTo(12, 3);
  });

  it('Sessions ohne geloggte Sätze und leere Eingaben fallen still raus', () => {
    expect(buildFreshness([{ finished_at: sqlUtcHoursAgo(NOW, 5), exercises: [] }], NOW)).toEqual({});
    expect(buildFreshness(null, NOW)).toEqual({});
  });
});
