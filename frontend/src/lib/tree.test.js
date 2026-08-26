import { describe, it, expect } from 'vitest';
import { buildTree, TREE_WIDTH, TREE_HEIGHT } from './tree.js';

const week = (weekStart, overrides = {}) => ({
  week_start: weekStart,
  workouts: 3,
  tonnage_kg: 1200,
  prs: 1,
  max_tests: 0,
  ...overrides,
});

describe('buildTree', () => {
  it('leere Historie ergibt Setzling', () => {
    const tree = buildTree([]);
    expect(tree.seedling).toBe(true);
    expect(tree.branches).toEqual([]);
    expect(tree.totals).toEqual({ weeks: 0, workouts: 0, prs: 0, maxTests: 0 });
  });

  it('ein Ast pro Trainingswoche, Summen stimmen', () => {
    const weeks = [
      week('2026-08-03'),
      week('2026-08-10', { workouts: 2, prs: 0, max_tests: 1 }),
      week('2026-08-17', { workouts: 4, prs: 2 }),
    ];
    const tree = buildTree(weeks);
    expect(tree.seedling).toBe(false);
    expect(tree.branches).toHaveLength(3);
    expect(tree.totals).toEqual({ weeks: 3, workouts: 9, prs: 3, maxTests: 1 });
    expect(tree.branches[1].fruits).toHaveLength(1);
    expect(tree.branches[2].blossoms).toHaveLength(2);
  });

  it('ist deterministisch — gleicher Verlauf, gleicher Baum', () => {
    const weeks = [week('2026-08-03'), week('2026-08-10')];
    expect(buildTree(weeks)).toEqual(buildTree(weeks));
  });

  it('Blüten sind gedeckelt, Überschuss wird gemeldet', () => {
    const tree = buildTree([week('2026-08-03', { prs: 9 })]);
    expect(tree.branches[0].blossoms).toHaveLength(6);
    expect(tree.branches[0].extraBlossoms).toBe(3);
  });

  it('Wochen ohne Aktivität wachsen nicht', () => {
    const tree = buildTree([week('2026-08-03'), week('2026-08-10', { workouts: 0, tonnage_kg: 0, prs: 0 })]);
    expect(tree.branches).toHaveLength(1);
  });

  it('alle Koordinaten bleiben im viewBox-Raum', () => {
    const weeks = Array.from({ length: 30 }, (_, i) =>
      week(`2026-${String(1 + Math.floor(i / 4)).padStart(2, '0')}-${String(1 + (i % 4) * 7).padStart(2, '0')}`, {
        workouts: 1 + (i % 4),
        prs: i % 3,
        max_tests: i % 5 === 0 ? 1 : 0,
      })
    );
    const tree = buildTree(weeks);
    for (const branch of tree.branches) {
      expect(branch.leaf.x).toBeGreaterThan(0);
      expect(branch.leaf.x).toBeLessThan(TREE_WIDTH);
      expect(branch.leaf.y).toBeGreaterThan(0);
      expect(branch.leaf.y).toBeLessThan(TREE_HEIGHT);
    }
  });
});
