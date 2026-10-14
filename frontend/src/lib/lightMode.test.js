import { describe, it, expect } from 'vitest';
import { lightWeight, lightenExercise } from './lightMode.js';

describe('lightWeight', () => {
  it('reduziert um 10 % und rundet auf den Gewichtsschritt ab — keine erfundenen Gewichte', () => {
    expect(lightWeight(60)).toBe(52.5);
    expect(lightWeight(40)).toBe(35);
    expect(lightWeight(10)).toBe(7.5);
    expect(lightWeight(50, 5)).toBe(45);
    expect(lightWeight(16, 4)).toBe(12);
  });

  it('behält das Gewicht, wenn schon der kleinste Schritt erreicht ist', () => {
    expect(lightWeight(2.5)).toBe(2.5);
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
    expect(lightenExercise(wt)).toMatchObject({ sets: 2, default_weight_kg: 35 });

    const bw = { id: 'pu', type: 'bw', sets: 1, default_weight_kg: null };
    expect(lightenExercise(bw)).toMatchObject({ sets: 1, default_weight_kg: null });
  });

  it('lässt Cooldown-Übungen unangetastet', () => {
    const stretch = { id: 'st', type: 'time', sets: 1, phase: 'cooldown', target_seconds: 30 };
    expect(lightenExercise(stretch)).toBe(stretch);
  });
});
