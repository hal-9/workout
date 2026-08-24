import { describe, it, expect } from 'vitest';
import { planSchema } from 'shared';
import {
  effectiveProgression,
  planDeloadWeeks,
  supportsProgression,
  withPlanDeload,
  withProgression,
} from '../../frontend/src/lib/progressionEdit.js';

function ex(overrides = {}) {
  return {
    id: 'bench',
    name: 'Bankdrücken',
    muscle: 'Brust',
    type: 'wt',
    sets: 3,
    target_reps: '8-12',
    target_seconds: null,
    default_weight_kg: 40,
    cue: '',
    video_query: '',
    ...overrides,
  };
}

const plan = (exercises) => ({
  schema_version: 1,
  name: 'P',
  days: [{ key: 'd', name: 'D', focus: '', exercises }],
});

describe('supportsProgression', () => {
  it('gilt für wt/bw/time, nicht für cardio und Cooldown', () => {
    expect(supportsProgression(ex())).toBe(true);
    expect(supportsProgression(ex({ type: 'bw' }))).toBe(true);
    expect(supportsProgression(ex({ type: 'time' }))).toBe(true);
    expect(supportsProgression(ex({ type: 'cardio' }))).toBe(false);
    expect(supportsProgression(ex({ phase: 'cooldown' }))).toBe(false);
  });
});

describe('effectiveProgression', () => {
  it('zeigt die Voreinstellung, wenn nichts gesetzt ist', () => {
    expect(effectiveProgression(ex())).toMatchObject({ enabled: true, type: 'weight', increment: 2.5, after_success: 2 });
  });

  it('zeigt abgeschaltete Übungen als aus', () => {
    expect(effectiveProgression(ex({ progression: null })).enabled).toBe(false);
  });
});

describe('withProgression', () => {
  it('schaltet ab und wieder ein', () => {
    const off = withProgression(ex(), { enabled: false });
    expect(off.progression).toBeNull();
    const on = withProgression(off, { enabled: true });
    expect(on.progression).toMatchObject({ type: 'weight', increment: 2.5, after_success: 2 });
  });

  it('übernimmt geänderte Werte', () => {
    const next = withProgression(ex(), { increment: 5, after_success: 3 });
    expect(next.progression).toMatchObject({ increment: 5, after_success: 3 });
    expect(planSchema.safeParse(plan([next])).success).toBe(true);
  });

  it('setzt deload_factor mit, wenn Deload aktiv wird', () => {
    const next = withProgression(ex(), { deload_every_weeks: 5 });
    expect(next.progression).toMatchObject({ deload_every_weeks: 5, deload_factor: 0.9 });
  });
});

describe('planDeloadWeeks / withPlanDeload', () => {
  it('liest den kleinsten konfigurierten Wert', () => {
    expect(planDeloadWeeks(plan([ex()]))).toBeNull();
    const withDeload = plan([
      ex({ progression: { type: 'weight', increment: 2.5, deload_every_weeks: 6 } }),
      ex({ id: 'pu', type: 'bw', default_weight_kg: null, progression: { type: 'reps', increment: 2, deload_every_weeks: 4 } }),
    ]);
    expect(planDeloadWeeks(withDeload)).toBe(4);
  });

  it('setzt Deload auf allen aktiven Übungen und lässt cardio/cooldown/aus in Ruhe', () => {
    const source = plan([
      ex(),
      ex({ id: 'tm', type: 'cardio', target_reps: null, target_seconds: 900, default_weight_kg: null }),
      ex({ id: 'stretch', type: 'time', target_reps: null, target_seconds: 45, default_weight_kg: null, phase: 'cooldown' }),
      ex({ id: 'off', progression: null }),
    ]);

    const next = withPlanDeload(source, 5);
    expect(next.days[0].exercises[0].progression).toMatchObject({ deload_every_weeks: 5 });
    expect(next.days[0].exercises[1].progression).toBeUndefined();
    expect(next.days[0].exercises[2].progression).toBeUndefined();
    expect(next.days[0].exercises[3].progression).toBeNull();
    expect(planSchema.safeParse(next).success).toBe(true);
  });

  it('entfernt Deload wieder', () => {
    const withDeload = withPlanDeload(plan([ex()]), 5);
    const without = withPlanDeload(withDeload, null);
    expect(without.days[0].exercises[0].progression.deload_every_weeks).toBeUndefined();
    expect(planDeloadWeeks(without)).toBeNull();
  });
});
