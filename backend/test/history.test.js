import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

function planA() {
  return {
    schema_version: 1,
    name: 'Plan A',
    days: [
      {
        key: 'push',
        name: 'Push',
        focus: 'Brust',
        exercises: [
          {
            id: 'pu',
            name: 'Liegestütze',
            muscle: 'Brust',
            type: 'bw',
            sets: 3,
            target_reps: '8-12',
            target_seconds: null,
            default_weight_kg: null,
            cue: 'cue',
            video_query: 'q',
          },
        ],
      },
    ],
  };
}

function planB() {
  return {
    schema_version: 1,
    name: 'Plan B',
    days: [
      {
        key: 'pushday',
        name: 'Push Day',
        focus: 'Brust',
        exercises: [
          {
            id: 'pu',
            name: 'Liegestütze',
            muscle: 'Brust',
            type: 'bw',
            sets: 3,
            target_reps: '8-12',
            target_seconds: null,
            default_weight_kg: null,
            cue: 'cue',
            video_query: 'q',
          },
          {
            id: 'noHistory',
            name: 'Neue Übung',
            muscle: 'x',
            type: 'bw',
            sets: 3,
            target_reps: '8-12',
            target_seconds: null,
            default_weight_kg: null,
            cue: 'cue',
            video_query: 'q',
          },
        ],
      },
    ],
  };
}

async function login(app) {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

describe('history', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    cookie = await login(app);
  });

  it('Prefill liefert jüngste finished Session je exercise_id auch aus anderem Plan; Übung ohne Historie fehlt', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(planA());
    const session = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    await request(app)
      .post(`/api/sessions/${session.body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
    await request(app).post(`/api/sessions/${session.body.session_id}/finish`).set('Cookie', cookie);

    await request(app).post('/api/plan').set('Cookie', cookie).send(planB());

    const res = await request(app).get('/api/history?day_key=pushday').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.prefill.pu).toEqual([
      { set_number: 1, reps: 10, weight_kg: null, duration_s: null, band_count: null, band_kg: null },
    ]);
    expect(res.body.prefill.noHistory).toBeUndefined();
  });

  it('discarded/active Sessions zählen nicht für Prefill', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(planA());
    const session = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    await request(app)
      .post(`/api/sessions/${session.body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
    // session stays active, never finished

    const res = await request(app).get('/api/history?day_key=push').set('Cookie', cookie);
    expect(res.body.prefill.pu).toBeUndefined();
  });

  it('recent_sessions liefert letzte 5 finished Sessions mit Sets', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(planA());
    const session = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    await request(app)
      .post(`/api/sessions/${session.body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
    await request(app).post(`/api/sessions/${session.body.session_id}/finish`).set('Cookie', cookie);

    const res = await request(app).get('/api/history?day_key=push').set('Cookie', cookie);
    expect(res.body.recent_sessions).toHaveLength(1);
    expect(res.body.recent_sessions[0].sets).toEqual([
      { exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null, band_count: null, band_kg: null },
    ]);
  });

  describe('targets (Vorgabe fürs nächste Workout)', () => {
    const rowPlan = (weight, reps = '8-15') => ({
      schema_version: 1,
      name: 'Rudern',
      days: [
        {
          key: 'pull',
          name: 'Pull',
          focus: 'Rücken',
          exercises: [
            { id: 'row', name: 'Rudern', muscle: 'Rücken', type: 'wt', sets: 2, target_reps: reps, target_seconds: null, default_weight_kg: weight, cue: 'c', video_query: 'q' },
          ],
        },
      ],
    });

    async function workout(sets, adaptations) {
      const s = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'pull' });
      const id = s.body.session_id;
      if (adaptations) await request(app).post(`/api/sessions/${id}/adaptations`).set('Cookie', cookie).send(adaptations);
      for (const [i, [reps, kg]] of sets.entries()) {
        await request(app)
          .post(`/api/sessions/${id}/sets`)
          .set('Cookie', cookie)
          .send({ exercise_id: 'row', set_number: i + 1, reps, weight_kg: kg, duration_s: null });
      }
      await request(app).post(`/api/sessions/${id}/finish`).set('Cookie', cookie);
    }

    const pairs = (res) => res.body.targets.row.map((r) => [r.reps, r.weight_kg]);

    it('15 Wdh. mit 10 kg werden beim nächsten Mal 15 mit 10 kg — nicht Plan, nicht mehr Gewicht', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(rowPlan(10));
      await workout([[15, 10], [13, 10]]);
      const res = await request(app).get('/api/history?day_key=pull').set('Cookie', cookie);
      expect(pairs(res)).toEqual([[15, 10], [13, 10]]);
    });

    it('übernommener Gewichtsschritt gilt genau einmal, danach zählt wieder das Geloggte', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(rowPlan(10));
      await workout([[15, 10], [15, 10]]);
      await request(app).post('/api/plan').set('Cookie', cookie).send(rowPlan(12.5));

      let res = await request(app).get('/api/history?day_key=pull').set('Cookie', cookie);
      expect(pairs(res)).toEqual([[8, 12.5], [8, 12.5]]);
      expect(res.body.prefill.row.map((r) => r.weight_kg)).toEqual([10, 10]);

      await workout([[9, 12.5], [8, 12.5]]);
      res = await request(app).get('/api/history?day_key=pull').set('Cookie', cookie);
      expect(pairs(res)).toEqual([[9, 12.5], [8, 12.5]]);
    });

    it('leichte Version wird nicht zur normalen Vorgabe', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(rowPlan(10));
      await workout([[15, 10], [15, 10]]);
      await workout([[12, 7.5]], { light: true });
      const res = await request(app).get('/api/history?day_key=pull').set('Cookie', cookie);
      expect(pairs(res)).toEqual([[15, 10], [15, 10]]);
    });
  });
});
