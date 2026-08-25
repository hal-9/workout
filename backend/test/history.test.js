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
      { set_number: 1, reps: 10, weight_kg: null, duration_s: null },
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
      { exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null },
    ]);
  });
});
