import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

function validPlan(overrides = {}) {
  return {
    schema_version: 1,
    name: 'Home Push/Pull/Legs',
    days: [
      {
        key: 'push',
        name: 'Push & Core',
        focus: 'Brust · Schultern · Trizeps · Core',
        exercises: [
          {
            id: 'pu',
            name: 'Liegestütze',
            muscle: 'Brust · Schulter · Trizeps',
            type: 'bw',
            sets: 5,
            target_reps: '8-12',
            target_seconds: null,
            default_weight_kg: null,
            cue: 'Körper als Linie',
            video_query: 'push up form',
          },
        ],
      },
    ],
    ...overrides,
  };
}

async function login(app) {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

describe('plan', () => {
  let app;

  beforeEach(() => {
    ({ app } = setupTestApp());
  });

  describe('POST /api/plan', () => {
    it('valid plan -> 201 and becomes active', async () => {
      const cookie = await login(app);
      const res = await request(app)
        .post('/api/plan')
        .set('Cookie', cookie)
        .send(validPlan());

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ plan_id: expect.any(Number) });

      const getRes = await request(app).get('/api/plan').set('Cookie', cookie);
      expect(getRes.status).toBe(200);
      expect(getRes.body.plan_id).toBe(res.body.plan_id);
      expect(getRes.body.name).toBe('Home Push/Pull/Legs');
    });

    it('deactivates old plan when new one is imported', async () => {
      const cookie = await login(app);
      const first = await request(app).post('/api/plan').set('Cookie', cookie).send(validPlan());
      const second = await request(app)
        .post('/api/plan')
        .set('Cookie', cookie)
        .send(validPlan({ name: 'Plan v2' }));

      const getRes = await request(app).get('/api/plan').set('Cookie', cookie);
      expect(getRes.body.plan_id).toBe(second.body.plan_id);
      expect(getRes.body.plan_id).not.toBe(first.body.plan_id);
    });

    it('schema_version 2 -> 422 unsupported schema_version', async () => {
      const cookie = await login(app);
      const res = await request(app)
        .post('/api/plan')
        .set('Cookie', cookie)
        .send(validPlan({ schema_version: 2 }));

      expect(res.status).toBe(422);
      expect(res.body).toEqual({ error: 'unsupported schema_version' });
    });

    it('duplicate exercise id -> 422', async () => {
      const cookie = await login(app);
      const plan = validPlan();
      plan.days.push({ ...plan.days[0], key: 'push2' });
      const res = await request(app).post('/api/plan').set('Cookie', cookie).send(plan);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('validation failed');
    });

    it('duplicate day key -> 422', async () => {
      const cookie = await login(app);
      const plan = validPlan();
      plan.days.push({
        ...plan.days[0],
        exercises: [{ ...plan.days[0].exercises[0], id: 'other' }],
      });
      const res = await request(app).post('/api/plan').set('Cookie', cookie).send(plan);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('validation failed');
    });

    it('missing required field -> 422 with details', async () => {
      const cookie = await login(app);
      const plan = validPlan();
      delete plan.days[0].exercises[0].name;
      const res = await request(app).post('/api/plan').set('Cookie', cookie).send(plan);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('validation failed');
      expect(Array.isArray(res.body.details)).toBe(true);
    });

    it('unknown fields are stripped', async () => {
      const cookie = await login(app);
      const plan = validPlan();
      plan.days[0].exercises[0].bogus_field = 'x';
      const res = await request(app).post('/api/plan').set('Cookie', cookie).send(plan);
      expect(res.status).toBe(201);

      const getRes = await request(app).get('/api/plan').set('Cookie', cookie);
      expect(getRes.body.days[0].exercises[0].bogus_field).toBeUndefined();
    });
  });

  describe('GET /api/plan', () => {
    it('returns 404 without an active plan', async () => {
      const cookie = await login(app);
      const res = await request(app).get('/api/plan').set('Cookie', cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'no active plan' });
    });
  });
});
