import { describe, it, expect } from 'vitest';
import { hasTonnage, recordList, tonnageByWeek, topMuscles } from '../../frontend/src/lib/statsView.js';

function sqlUtcDaysAgo(days) {
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

describe('tonnageByWeek', () => {
  it('liefert eine Zeile pro Woche, älteste zuerst', () => {
    const weeks = tonnageByWeek([], 12);
    expect(weeks).toHaveLength(12);
    expect(weeks[0].week_start < weeks[11].week_start).toBe(true);
  });

  it('summiert die Tonnage der aktuellen Woche', () => {
    const weeks = tonnageByWeek(
      [
        { finished_at: sqlUtcDaysAgo(0), tonnage_kg: 500 },
        { finished_at: sqlUtcDaysAgo(0), tonnage_kg: 260 },
      ],
      12
    );
    expect(weeks[weeks.length - 1]).toMatchObject({ tonnage_kg: 760, sessions: 2 });
  });

  it('behandelt fehlende Tonnage als 0', () => {
    const weeks = tonnageByWeek([{ finished_at: sqlUtcDaysAgo(0) }], 4);
    expect(weeks[weeks.length - 1].tonnage_kg).toBe(0);
  });
});

describe('hasTonnage', () => {
  it('erkennt, ob überhaupt Gewicht bewegt wurde', () => {
    expect(hasTonnage([{ tonnage_kg: 0 }, { tonnage_kg: 0 }])).toBe(false);
    expect(hasTonnage([{ tonnage_kg: 0 }, { tonnage_kg: 120 }])).toBe(true);
    expect(hasTonnage([])).toBe(false);
  });
});

describe('topMuscles', () => {
  it('sortiert nach Sätzen und rechnet den Anteil zum Maximum', () => {
    const result = topMuscles(
      [
        { muscle: 'Brust', sets: 6, tonnage_kg: 700 },
        { muscle: 'Rücken', sets: 12, tonnage_kg: 900 },
      ],
      2
    );
    expect(result[0].muscle).toBe('Rücken');
    expect(result[0].share).toBe(1);
    expect(result[1].share).toBe(0.5);
  });

  it('begrenzt die Anzahl', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ muscle: `M${i}`, sets: i + 1 }));
    expect(topMuscles(many, 3)).toHaveLength(3);
  });

  it('verkraftet leere Eingaben', () => {
    expect(topMuscles([], 5)).toEqual([]);
  });
});

describe('recordList', () => {
  const records = [
    { exercise_id: 'bench', name: 'Bankdrücken', muscle: 'Brust', type: 'wt', sessions_count: 5, max_weight: 45, max_e1rm: 58.3, max_reps: 10, volume: 800, max_duration: null },
    { exercise_id: 'pu', name: 'Liegestütze', muscle: 'Brust', type: 'bw', sessions_count: 9, max_reps: 15, max_weight: null, max_e1rm: null, volume: null, max_duration: null },
    { exercise_id: 'leer', name: 'Nie gemacht', muscle: 'X', type: 'wt', sessions_count: 0, max_weight: null, max_e1rm: null, max_reps: null, volume: null, max_duration: null },
  ];

  it('sortiert nach Session-Zahl und lässt Übungen ohne Bestwert weg', () => {
    const list = recordList(records);
    expect(list.map((r) => r.exercise_id)).toEqual(['pu', 'bench']);
  });

  it('nimmt je Typ den passenden Bestwert und e1RM nur bei Gewichtsübungen', () => {
    const list = recordList(records);
    expect(list.find((r) => r.exercise_id === 'bench')).toMatchObject({ kind: 'weight', value: 45, e1rm: 58.3 });
    expect(list.find((r) => r.exercise_id === 'pu')).toMatchObject({ kind: 'reps', value: 15, e1rm: null });
  });

  it('begrenzt die Liste', () => {
    expect(recordList(records, 1)).toHaveLength(1);
  });
});
