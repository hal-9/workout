import { describe, expect, it } from 'vitest';
import { compareExercise, lastPerformed } from './exerciseCompare.js';

const bw = { id: 'pullup', type: 'bw', sets: 3, target_reps: '5-8' };
const cardio = { id: 'run', type: 'cardio', sets: 1, target_seconds: 1200 };

describe('lastPerformed', () => {
  it('nimmt die Wiederholungen der letzten Session als Ziel', () => {
    expect(lastPerformed(bw, [{ reps: 10 }, { reps: 10 }, { reps: 10 }])).toEqual({ reps: '10' });
    expect(lastPerformed(bw, [{ reps: 10 }, { reps: 10 }, { reps: 8 }])).toEqual({ reps: '10/10/8' });
  });

  it('mittelt Dauern und fällt ohne Historie auf den Plan zurück', () => {
    expect(lastPerformed(cardio, [{ duration_s: 900 }, { duration_s: 1100 }])).toEqual({ seconds: 1000 });
    expect(lastPerformed(bw, [])).toBeNull();
    expect(compareExercise(bw, [], null).last).toBeNull();
  });
});
