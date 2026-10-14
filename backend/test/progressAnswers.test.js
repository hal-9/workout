import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { compareExposures, pickImprovementFacts } from 'shared/progressAnswers';
import { setupTestApp } from './helpers.js';

const rudern = { id: 'row', name: 'Rudern', type: 'wt' };
const sets = (...pairs) => pairs.map(([reps, weight_kg], i) => ({ set_number: i + 1, reps, weight_kg }));

describe('compareExposures', () => {
  it('12 → 15 Wdh. bei 10 kg wird als Fortschritt erkannt (nicht nur Max-Gewicht)', () => {
    expect(compareExposures(rudern, sets([12, 10]), sets([15, 10]))).toEqual({
      kind: 'more_reps',
      text: 'Rudern: 12 → 15 Wdh. bei gleichem Gewicht',
    });
  });

  it('mehrere Sätze: Summe über dieselbe Satzzahl', () => {
    expect(compareExposures(rudern, sets([12, 10], [12, 10]), sets([13, 10], [12, 10])).text).toBe(
      'Rudern: 24 → 25 Wdh. in 2 Sätzen bei gleichem Gewicht'
    );
  });

  it('mehr Gewicht bei mindestens gleichen Wdh.', () => {
    expect(compareExposures(rudern, sets([10, 10]), sets([10, 12.5])).text).toBe(
      'Rudern: 10 → 12,5 kg bei mindestens gleichen Wdh.'
    );
  });

  it('gleiche Werte: Leistung gehalten', () => {
    expect(compareExposures(rudern, sets([15, 10]), sets([15, 10])).kind).toBe('held');
  });

  it('mehr Gewicht, weniger Wdh. / andere Satzzahl / andere Bänder: nicht vergleichbar', () => {
    expect(compareExposures(rudern, sets([15, 10]), sets([8, 12.5])).kind).toBe('not_comparable');
    expect(compareExposures(rudern, sets([15, 10], [15, 10]), sets([16, 10])).kind).toBe('not_comparable');
    const band = { id: 'pull', name: 'Klimmzug', type: 'bw' };
    const a = [{ set_number: 1, reps: 5, band_count: 2 }];
    const b = [{ set_number: 1, reps: 6, band_count: 3 }];
    expect(compareExposures(band, a, b).kind).toBe('not_comparable');
  });

  it('Cardio wird nicht bewertet', () => {
    expect(compareExposures({ type: 'cardio' }, [{ set_number: 1, duration_s: 600 }], [{ set_number: 1, duration_s: 900 }])).toBeNull();
  });

  it('Fakten: erst Verbesserungen in Plan-Reihenfolge, höchstens zwei', () => {
    const facts = pickImprovementFacts([
      { kind: 'held', text: 'a' },
      { kind: 'more_reps', text: 'b' },
      { kind: 'not_comparable', text: 'c' },
      { kind: 'more_weight', text: 'd' },
      { kind: 'longer', text: 'e' },
    ]);
    expect(facts.map((f) => f.text)).toEqual(['b', 'd']);
  });
});

describe('GET /api/progress/summary', () => {
  let app;
  let cookie;
  const plan = {
    schema_version: 1,
    name: 'Test',
    days: [
      {
        key: 'pull',
        name: 'Pull',
        focus: 'Rücken',
        exercises: [
          { id: 'row', name: 'Rudern', muscle: 'Rücken', type: 'wt', sets: 1, target_reps: '8-15', target_seconds: null, default_weight_kg: 10, cue: '', video_query: '' },
        ],
      },
    ],
  };

  async function workout(reps) {
    const s = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'pull' });
    await request(app)
      .post(`/api/sessions/${s.body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'row', set_number: 1, reps, weight_kg: 10, duration_s: null });
    await request(app).post(`/api/sessions/${s.body.session_id}/finish`).set('Cookie', cookie).send({});
  }

  beforeEach(async () => {
    ({ app } = setupTestApp());
    const res = await request(app).post('/api/login').send({ email: 'tuncay@example.com', password: 'password1' });
    cookie = res.headers['set-cookie'][0];
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan);
  });

  it('ein Workout: noch kein Vergleich', async () => {
    await workout(12);
    const res = await request(app).get('/api/progress/summary').set('Cookie', cookie);
    expect(res.body.improvement).toEqual({ state: 'no_comparison', facts: [] });
  });

  it('zwei Workouts: Fakt mit Daten', async () => {
    await workout(12);
    await workout(13);
    const res = await request(app).get('/api/progress/summary').set('Cookie', cookie);
    expect(res.body.improvement.facts).toHaveLength(1);
    expect(res.body.improvement.facts[0]).toMatchObject({ kind: 'more_reps', text: 'Rudern: 12 → 13 Wdh. bei gleichem Gewicht' });
    expect(res.body.improvement.facts[0].dates).toHaveLength(2);
  });
});
