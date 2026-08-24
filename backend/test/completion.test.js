import { describe, it, expect } from 'vitest';
import {
  completionHeadline,
  easeOutCubic,
  particleLayout,
  shouldCountUp,
  summarizeSession,
} from '../../frontend/src/lib/completion.js';

const day = {
  key: 'push',
  name: 'Push',
  focus: '',
  exercises: [
    { id: 'bench', name: 'Bankdrücken', muscle: 'Brust', type: 'wt', sets: 3, target_reps: '8-12', target_seconds: null, default_weight_kg: 40, cue: '', video_query: '' },
    { id: 'pu', name: 'Liegestütze', muscle: 'Brust', type: 'bw', sets: 3, target_reps: '10', target_seconds: null, default_weight_kg: null, cue: '', video_query: '' },
    { id: 'stretch', name: 'Dehnung', muscle: 'Brust', type: 'time', sets: 1, target_reps: null, target_seconds: 45, default_weight_kg: null, cue: '', video_query: '', phase: 'cooldown' },
  ],
};

describe('summarizeSession', () => {
  it('zählt Sätze und Tonnage des Hauptteils, Cooldown getrennt', () => {
    const summary = {
      exercises: [
        { exercise_id: 'bench', sets: [{ reps: 10, weight_kg: 40 }, { reps: 8, weight_kg: 45 }] },
        { exercise_id: 'pu', sets: [{ reps: 12 }] },
        { exercise_id: 'stretch', sets: [{ duration_s: 45 }] },
      ],
    };
    expect(summarizeSession(day, summary, 42 * 60000)).toEqual({
      sets: 3,
      cooldown_sets: 1,
      exercises: 2,
      tonnage_kg: 760,
      duration_min: 42,
    });
  });

  it('rundet kurze Sessions auf eine Minute auf und verkraftet fehlende Zeit', () => {
    const summary = { exercises: [{ exercise_id: 'pu', sets: [{ reps: 10 }] }] };
    expect(summarizeSession(day, summary, 20000).duration_min).toBe(1);
    expect(summarizeSession(day, summary, null).duration_min).toBeNull();
    expect(summarizeSession(day, summary, 0).duration_min).toBeNull();
  });

  it('ignoriert Übungen ohne Sätze und unbekannte Ids', () => {
    const summary = {
      exercises: [
        { exercise_id: 'bench', sets: [] },
        { exercise_id: 'fremd', sets: [{ reps: 10, weight_kg: 100 }] },
      ],
    };
    expect(summarizeSession(day, summary, 60000)).toMatchObject({ sets: 1, exercises: 1, tonnage_kg: 0 });
  });

  it('verkraftet leere Eingaben', () => {
    expect(summarizeSession(null, null, null)).toEqual({
      sets: 0,
      cooldown_sets: 0,
      exercises: 0,
      tonnage_kg: 0,
      duration_min: null,
    });
  });
});

describe('completionHeadline', () => {
  it('passt sich der Rekord-Zahl an', () => {
    expect(completionHeadline([])).toBe('Workout geschafft');
    expect(completionHeadline([{}])).toBe('Neuer Rekord!');
    expect(completionHeadline([{}, {}])).toBe('2 neue Rekorde!');
  });
});

describe('easeOutCubic', () => {
  it('läuft von 0 nach 1 und klemmt außerhalb', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3);
  });
});

describe('particleLayout', () => {
  it('erzeugt deterministische Partikel', () => {
    const a = particleLayout(14);
    const b = particleLayout(14);
    expect(a).toHaveLength(14);
    expect(a).toEqual(b);
    expect(a.every((p) => Number.isFinite(p.dx) && Number.isFinite(p.dy))).toBe(true);
    expect(a.some((p) => p.dx > 0) && a.some((p) => p.dx < 0)).toBe(true);
  });
});

describe('shouldCountUp', () => {
  it('zählt nur größere Zahlen hoch', () => {
    expect(shouldCountUp(1)).toBe(false);
    expect(shouldCountUp(9)).toBe(false);
    expect(shouldCountUp(10)).toBe(true);
    expect(shouldCountUp(760)).toBe(true);
    expect(shouldCountUp(null)).toBe(false);
    expect(shouldCountUp(undefined)).toBe(false);
  });
});
