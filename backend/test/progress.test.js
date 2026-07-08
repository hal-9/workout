import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

function plan(overrides = {}) {
  return {
    schema_version: 1,
    name: 'Test Plan',
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
      {
        key: 'pull',
        name: 'Pull',
        focus: 'Rücken',
        exercises: [
          {
            id: 'row',
            name: 'Rudern',
            muscle: 'Rücken',
            type: 'wt',
            sets: 3,
            target_reps: '8-12',
            target_seconds: null,
            default_weight_kg: 10,
            cue: 'cue',
            video_query: 'q',
          },
        ],
      },
      {
        key: 'core',
        name: 'Core',
        focus: 'Core',
        exercises: [
          {
            id: 'plank',
            name: 'Plank',
            muscle: 'Core',
            type: 'time',
            sets: 3,
            target_reps: null,
            target_seconds: 30,
            default_weight_kg: null,
            cue: 'cue',
            video_query: 'q',
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function login(app, name = 'tuncay', password = 'password1') {
  const res = await request(app).post('/api/login').send({ name, password });
  return res.headers['set-cookie'][0];
}

async function finishSession(app, cookie, dayKey, sets) {
  const sessionRes = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: dayKey });
  const sessionId = sessionRes.body.session_id;
  for (const set of sets) {
    await request(app).post(`/api/sessions/${sessionId}/sets`).set('Cookie', cookie).send(set);
  }
  await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
  return sessionId;
}

describe('progress', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    cookie = await login(app);
  });

  describe('GET /api/progress', () => {
    it('kein Plan -> 404', async () => {
      const res = await request(app).get('/api/progress').set('Cookie', cookie);
      expect(res.status).toBe(404);
    });

    it('Plan ohne Sessions -> leere Highlights, alle Übungen ohne Punkte', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const res = await request(app).get('/api/progress').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.plan_name).toBe('Test Plan');
      expect(res.body.highlights).toEqual([]);
      expect(res.body.exercises).toHaveLength(3);
      expect(res.body.exercises.every((e) => e.points.length === 0)).toBe(true);
    });

    it('aggregiert bw/wt/time Metriken über Sessions', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());

      await finishSession(app, cookie, 'push', [
        { exercise_id: 'pu', set_number: 1, reps: 8, weight_kg: null, duration_s: null },
        { exercise_id: 'pu', set_number: 2, reps: 10, weight_kg: null, duration_s: null },
      ]);

      db.prepare("UPDATE sessions SET finished_at = '2026-07-01 10:00:00' WHERE day_key = 'push'").run();

      await finishSession(app, cookie, 'push', [
        { exercise_id: 'pu', set_number: 1, reps: 12, weight_kg: null, duration_s: null },
      ]);

      await finishSession(app, cookie, 'pull', [
        { exercise_id: 'row', set_number: 1, reps: 10, weight_kg: 10, duration_s: null },
        { exercise_id: 'row', set_number: 2, reps: 8, weight_kg: 12, duration_s: null },
      ]);

      await finishSession(app, cookie, 'core', [
        { exercise_id: 'plank', set_number: 1, reps: null, weight_kg: null, duration_s: 25 },
        { exercise_id: 'plank', set_number: 2, reps: null, weight_kg: null, duration_s: 35 },
      ]);

      const res = await request(app).get('/api/progress').set('Cookie', cookie);
      expect(res.status).toBe(200);

      const pushups = res.body.exercises.find((e) => e.exercise_id === 'pu');
      expect(pushups.metric_label).toBe('Wdh.');
      expect(pushups.points).toHaveLength(2);
      expect(pushups.points[0].value).toBe(10);
      expect(pushups.points[1].value).toBe(12);
      expect(pushups.first_value).toBe(10);
      expect(pushups.latest_value).toBe(12);
      expect(pushups.trend).toBe('up');
      expect(pushups.target).toEqual({ min: 8, max: 12 });

      const row = res.body.exercises.find((e) => e.exercise_id === 'row');
      expect(row.metric_label).toBe('kg');
      expect(row.points[0].value).toBe(12);

      const plank = res.body.exercises.find((e) => e.exercise_id === 'plank');
      expect(plank.metric_label).toBe('s');
      expect(plank.points[0].value).toBe(35);
      expect(plank.target).toEqual({ seconds: 30 });
    });

    it('gewichtete Übung rankt in Highlights höher', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());

      await finishSession(app, cookie, 'push', [
        { exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null },
      ]);
      await finishSession(app, cookie, 'pull', [
        { exercise_id: 'row', set_number: 1, reps: 10, weight_kg: 10, duration_s: null },
      ]);

      const res = await request(app).get('/api/progress').set('Cookie', cookie);
      expect(res.body.highlights[0].exercise_id).toBe('row');
    });

    it('nur Sessions des aktiven Plans', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      await finishSession(app, cookie, 'push', [
        { exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null },
      ]);

      const oldPlanId = db.prepare('SELECT id FROM plans WHERE active = 1').get().id;

      await request(app)
        .post('/api/plan')
        .set('Cookie', cookie)
        .send(
          plan({
            days: [
              {
                key: 'legs',
                name: 'Legs',
                focus: 'Beine',
                exercises: [
                  {
                    id: 'squat',
                    name: 'Kniebeuge',
                    muscle: 'Beine',
                    type: 'bw',
                    sets: 3,
                    target_reps: '10',
                    target_seconds: null,
                    default_weight_kg: null,
                    cue: 'cue',
                    video_query: 'q',
                  },
                ],
              },
            ],
          })
        );

      const res = await request(app).get('/api/progress').set('Cookie', cookie);
      expect(res.body.plan_id).not.toBe(oldPlanId);
      expect(res.body.exercises).toHaveLength(1);
      expect(res.body.exercises[0].exercise_id).toBe('squat');
      expect(res.body.highlights).toEqual([]);
    });

    it('Nutzer sieht nur eigenen Fortschritt', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      await finishSession(app, cookie, 'push', [
        { exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null },
      ]);

      const partnerCookie = await login(app, 'partnerin', 'password2');
      const res = await request(app).get('/api/progress').set('Cookie', partnerCookie);
      expect(res.status).toBe(404);
    });
  });
});
