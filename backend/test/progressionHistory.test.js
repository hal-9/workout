import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

// D06: Plan-Versionen dürfen die Progressions-Serie nicht zurücksetzen.
const plan = (overrides = {}) => ({
  schema_version: 1,
  name: 'Test',
  days: [
    {
      key: 'pull',
      name: 'Pull',
      focus: 'Rücken',
      exercises: [
        { id: 'row', name: 'Rudern', muscle: 'Rücken', type: 'wt', equipment: 'kurzhantel', sets: 2, target_reps: '8-15', target_seconds: null, default_weight_kg: 10, cue: 'Rücken gerade', video_query: '', ...overrides },
      ],
    },
  ],
});

describe('Progression über Plan-Versionen', () => {
  let app;
  let cookie;

  async function workout(reps, kg, adaptations) {
    const s = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'pull' });
    const id = s.body.session_id;
    if (adaptations) await request(app).post(`/api/sessions/${id}/adaptations`).set('Cookie', cookie).send(adaptations);
    for (const n of [1, 2]) {
      await request(app)
        .post(`/api/sessions/${id}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'row', set_number: n, reps, weight_kg: kg, duration_s: null });
    }
    await request(app).post(`/api/sessions/${id}/finish`).set('Cookie', cookie).send({});
  }

  const proposals = async () =>
    (await request(app).get('/api/progression/proposals').set('Cookie', cookie)).body.proposals;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    const res = await request(app).post('/api/login').send({ email: 'tuncay@example.com', password: 'password1' });
    cookie = res.headers['set-cookie'][0];
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
  });

  it('Hinweis-Text im Plan geändert: Vorschlag bleibt', async () => {
    await workout(15, 10);
    await workout(15, 10);
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan({ cue: 'Schultern unten' }));
    expect(await proposals()).toMatchObject([{ exercise_id: 'row', to: 12.5 }]);
  });

  it('Serie läuft über einen Plan-Edit hinweg weiter', async () => {
    await workout(15, 10);
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan({ cue: 'Schultern unten' }));
    await workout(15, 10);
    expect(await proposals()).toMatchObject([{ exercise_id: 'row', to: 12.5 }]);
  });

  it('übernommener Vorschlag wird nicht erneut angeboten', async () => {
    await workout(15, 10);
    await workout(15, 10);
    await request(app).post('/api/progression/apply').set('Cookie', cookie).send({ exercise_ids: ['row'] });
    expect(await proposals()).toEqual([]);
  });

  it('leichte Version unterbricht die Serie nicht', async () => {
    await workout(15, 10);
    await workout(10, 7.5, { light: true });
    await workout(15, 10);
    expect(await proposals()).toMatchObject([{ exercise_id: 'row', to: 12.5 }]);
  });
});
