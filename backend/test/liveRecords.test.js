import { describe, it, expect } from 'vitest';
import {
  bestsByExerciseId,
  formatRecordValue,
  livePreviewRecord,
  loggedSetsFromRows,
  primaryBest,
} from '../../frontend/src/lib/records.js';

const bench = {
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
};

const treadmill = { ...bench, id: 'tm', name: 'Laufband', type: 'cardio', target_reps: null, target_seconds: 900, default_weight_kg: null };

describe('formatRecordValue', () => {
  it('formatiert je Rekordart', () => {
    expect(formatRecordValue('weight', 45)).toBe('45 kg');
    expect(formatRecordValue('e1rm', 58.33)).toBe('58.3 kg');
    expect(formatRecordValue('reps', 15)).toBe('15 Wdh.');
    expect(formatRecordValue('duration', 1500)).toBe('25 Min');
    expect(formatRecordValue('weight', null)).toBe('—');
  });
});

describe('loggedSetsFromRows', () => {
  it('nimmt nur abgehakte Sätze und rechnet Cardio-Minuten in Sekunden', () => {
    const sets = loggedSetsFromRows(treadmill, [
      { logged: true, reps: '', weight_kg: '', duration: '25' },
      { logged: false, reps: '', weight_kg: '', duration: '30' },
    ]);
    expect(sets).toEqual([{ reps: null, weight_kg: null, duration_s: 1500 }]);
  });

  it('wandelt leere Felder in null', () => {
    expect(loggedSetsFromRows(bench, [{ logged: true, reps: '10', weight_kg: '', duration: '' }])).toEqual([
      { reps: 10, weight_kg: null, duration_s: null },
    ]);
  });
});

describe('livePreviewRecord', () => {
  const best = { exercise_id: 'bench', type: 'wt', sessions_count: 3, max_weight: 40, max_reps: 10, max_e1rm: 53.3, volume: 800, max_duration: null };

  it('erkennt einen Gewichts-Rekord während des Trainings', () => {
    const record = livePreviewRecord(bench, [{ logged: true, reps: '8', weight_kg: '45', duration: '' }], best);
    expect(record).toMatchObject({ kind: 'weight', value: 45, previous: 40 });
  });

  it('kein Rekord ohne abgehakte Sätze', () => {
    expect(livePreviewRecord(bench, [{ logged: false, reps: '8', weight_kg: '45', duration: '' }], best)).toBeNull();
  });

  it('kein Rekord ohne Historie', () => {
    expect(livePreviewRecord(bench, [{ logged: true, reps: '8', weight_kg: '99', duration: '' }], null)).toBeNull();
    expect(
      livePreviewRecord(bench, [{ logged: true, reps: '8', weight_kg: '99', duration: '' }], { ...best, sessions_count: 0 })
    ).toBeNull();
  });

  it('kein Rekord bei gleichen Werten', () => {
    expect(livePreviewRecord(bench, [{ logged: true, reps: '10', weight_kg: '40', duration: '' }], best)).toBeNull();
  });
});

describe('bestsByExerciseId / primaryBest', () => {
  it('indexiert nach Übungs-Id', () => {
    const map = bestsByExerciseId([{ exercise_id: 'a' }, { exercise_id: 'b' }]);
    expect(map.get('b')).toEqual({ exercise_id: 'b' });
  });

  it('wählt den passenden Bestwert je Typ', () => {
    expect(primaryBest({ type: 'wt', max_weight: 45 })).toEqual({ kind: 'weight', value: 45 });
    expect(primaryBest({ type: 'bw', max_reps: 15 })).toEqual({ kind: 'reps', value: 15 });
    expect(primaryBest({ type: 'time', max_duration: 60 })).toEqual({ kind: 'duration', value: 60 });
    expect(primaryBest({ type: 'wt' })).toBeNull();
    expect(primaryBest(null)).toBeNull();
  });
});
