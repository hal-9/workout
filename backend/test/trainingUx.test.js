import { describe, it, expect } from 'vitest';
import {
  compareExercise,
  formatLastSummary,
  formatTargetLabel,
  parseTargetReps,
} from '../../frontend/src/lib/exerciseCompare.js';
import { suggestProgression, suggestionsFromSummary } from '../../frontend/src/lib/progression.js';
import { buildWeekRecap, groupSessionsByWeek, weekGoalMet } from '../../frontend/src/lib/weekRecap.js';

const wtExercise = {
  id: 'goblet',
  name: 'Goblet Squat',
  type: 'wt',
  sets: 3,
  target_reps: '8-12',
  default_weight_kg: 10,
};

describe('exerciseCompare', () => {
  it('parses rep ranges', () => {
    expect(parseTargetReps('8-12')).toEqual({ min: 8, max: 12 });
    expect(parseTargetReps('10')).toEqual({ min: 10, max: 10 });
  });

  it('formats last summary with weight', () => {
    const summary = formatLastSummary(wtExercise, [
      { set_number: 1, reps: 10, weight_kg: 10 },
      { set_number: 2, reps: 10, weight_kg: 10 },
      { set_number: 3, reps: 10, weight_kg: 10 },
    ]);
    expect(summary).toBe('3×10 @ 10 kg');
  });

  it('formats target label', () => {
    expect(formatTargetLabel(wtExercise)).toBe('8–12 Wdh.');
  });

  it('returns no trend until planned sets are logged', () => {
    const result = compareExercise(
      wtExercise,
      [
        { logged: true, reps: 12, weight_kg: 10 },
        { logged: false, reps: '', weight_kg: 10 },
        { logged: false, reps: '', weight_kg: 10 },
      ],
      [{ reps: 10, weight_kg: 10 }]
    );
    expect(result.trend).toBeNull();
  });

  it('detects upward trend vs last session', () => {
    const result = compareExercise(
      wtExercise,
      [
        { logged: true, reps: 12, weight_kg: 10 },
        { logged: true, reps: 12, weight_kg: 10 },
        { logged: true, reps: 12, weight_kg: 10 },
      ],
      [
        { reps: 10, weight_kg: 10 },
        { reps: 10, weight_kg: 10 },
        { reps: 10, weight_kg: 10 },
      ]
    );
    expect(result.trend).toBe('up');
  });
});

describe('progression', () => {
  it('suggests weight increase when all sets hit top of range', () => {
    const suggestion = suggestProgression(wtExercise, [
      { reps: 12, weight_kg: 10 },
      { reps: 12, weight_kg: 10 },
      { reps: 12, weight_kg: 10 },
    ]);
    expect(suggestion).toEqual({
      type: 'weight',
      exerciseId: 'goblet',
      exerciseName: 'Goblet Squat',
      message: 'Goblet Squat: Bereit für 12.5 kg?',
      nextValue: 12.5,
    });
  });

  it('returns null when reps below target', () => {
    expect(
      suggestProgression(wtExercise, [
        { reps: 8, weight_kg: 10 },
        { reps: 8, weight_kg: 10 },
        { reps: 8, weight_kg: 10 },
      ])
    ).toBeNull();
  });

  it('builds suggestions from session summary and plan', () => {
    const plan = {
      days: [
        {
          key: 'a',
          exercises: [wtExercise],
        },
      ],
    };
    const summary = {
      exercises: [
        {
          exercise_id: 'goblet',
          sets: [
            { reps: 12, weight_kg: 10 },
            { reps: 12, weight_kg: 10 },
            { reps: 12, weight_kg: 10 },
          ],
        },
      ],
    };
    expect(suggestionsFromSummary(plan, summary)).toHaveLength(1);
  });
});

describe('weekRecap', () => {
  const plan = {
    days: [
      { key: 'a', weekday: 'mon' },
      { key: 'b', weekday: 'tue' },
      { key: 'c', weekday: 'thu' },
      { key: 'd', weekday: 'fri' },
    ],
  };

  it('weekGoalMet requires 75% of planned days', () => {
    expect(weekGoalMet(3, 4)).toBe(true);
    expect(weekGoalMet(2, 4)).toBe(false);
  });

  it('buildWeekRecap computes average and streak', () => {
    const weeks = [
      { weekStart: new Date(2026, 5, 2), sessions: [{ day_key: 'a' }, { day_key: 'b' }, { day_key: 'c' }] },
      { weekStart: new Date(2026, 5, 9), sessions: [{ day_key: 'a' }, { day_key: 'b' }] },
      { weekStart: new Date(2026, 5, 16), sessions: [{ day_key: 'a' }, { day_key: 'b' }, { day_key: 'c' }] },
      { weekStart: new Date(2026, 5, 23), sessions: [{ day_key: 'a' }, { day_key: 'b' }, { day_key: 'c' }] },
    ];
    const recap = buildWeekRecap(plan, weeks);
    expect(recap.total).toBe(4);
    expect(recap.averageDone).toBe(2.8);
    expect(recap.streak).toBe(2);
    expect(recap.weeks[3].done).toBe(3);
  });

  it('groupSessionsByWeek buckets by local week', () => {
    const weekStart = new Date(2026, 6, 6);
    while (weekStart.getDay() !== 1) {
      weekStart.setDate(weekStart.getDate() - 1);
    }
    const monday = new Date(weekStart);
    const sessions = [
      { day_key: 'a', finished_at: `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')} 10:00:00` },
    ];
    const buckets = groupSessionsByWeek(sessions, 1);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].sessions).toHaveLength(1);
  });
});
