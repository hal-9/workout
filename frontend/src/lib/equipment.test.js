import { describe, it, expect } from 'vitest';
import { DEFAULT_WEIGHT_STEP, equipmentLabel, stepForExercise } from './equipment.js';

describe('stepForExercise', () => {
  it('uses 1 kg for dumbbells', () => {
    expect(stepForExercise({ equipment: 'kurzhantel' })).toBe(1);
  });

  it('uses 5 kg for machines', () => {
    expect(stepForExercise({ equipment: 'maschine' })).toBe(5);
  });

  it('resolves equipment from the library when the exercise omits it', () => {
    expect(stepForExercise({ id: 'hip-abduction-maschine', name: 'Abduktoren-Maschine' })).toBe(5);
  });

  it('resolves equipment by name for plan exercises without a library id', () => {
    expect(stepForExercise({ id: 'custom-1', name: 'Abduktion am Kabelzug' })).toBe(2.5);
  });

  it('falls back to the default for unknown equipment', () => {
    expect(stepForExercise({ equipment: 'sandsack' })).toBe(DEFAULT_WEIGHT_STEP);
    expect(stepForExercise(null)).toBe(DEFAULT_WEIGHT_STEP);
  });
});

describe('equipmentLabel', () => {
  it('labels known equipment in German', () => {
    expect(equipmentLabel({ equipment: 'koerpergewicht' })).toBe('Körpergewicht');
  });

  it('resolves through the library', () => {
    expect(equipmentLabel({ id: 'ab-wheel', name: 'Ab Wheel Rollout' })).toBe('Körpergewicht');
  });

  it('returns null when equipment is unknown', () => {
    expect(equipmentLabel({ equipment: 'sandsack' })).toBeNull();
    expect(equipmentLabel(null)).toBeNull();
  });
});
