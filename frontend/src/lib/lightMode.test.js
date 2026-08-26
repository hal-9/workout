import { describe, it, expect } from 'vitest';
import { lightWeight, lightenExercise } from './lightMode.js';

describe('lightWeight', () => {
  it('reduziert um 10 % und rundet auf 0,5 kg', () => {
    expect(lightWeight(60)).toBe(54);
    expect(lightWeight(40)).toBe(36);
    expect(lightWeight(10)).toBe(9);
    expect(lightWeight(7.5)).toBe(7);
  });

  it('lässt ungültige Werte unverändert', () => {
    expect(lightWeight('')).toBe('');
    expect(lightWeight(null)).toBe(null);
    expect(lightWeight(0)).toBe(0);
  });
});

describe('lightenExercise', () => {
  it('nimmt einen Satz weg (min. 1) und skaliert nur wt-Gewichte', () => {
    const wt = { id: 'bp', type: 'wt', sets: 3, default_weight_kg: 40 };
    expect(lightenExercise(wt)).toMatchObject({ sets: 2, default_weight_kg: 36 });

    const bw = { id: 'pu', type: 'bw', sets: 1, default_weight_kg: null };
    expect(lightenExercise(bw)).toMatchObject({ sets: 1, default_weight_kg: null });
  });

  it('lässt Cooldown-Übungen unangetastet', () => {
    const stretch = { id: 'st', type: 'time', sets: 1, phase: 'cooldown', target_seconds: 30 };
    expect(lightenExercise(stretch)).toBe(stretch);
  });
});
