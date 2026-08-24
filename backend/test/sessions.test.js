import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

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
    ],
    ...overrides,
  };
}

async function login(app) {
  const res = await request(app)
    .post('/api/login')
    .send({ name: 'tuncay', password: 'password1' });
  return res.headers['set-cookie'][0];
}

async function loginPartner(app) {
  const res = await request(app)
    .post('/api/login')
    .send({ name: 'partnerin', password: 'password2' });
  return res.headers['set-cookie'][0];
}

describe('sessions', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    generateContentMock.mockReset();
    generateContentMock.mockImplementation(() => new Promise(() => {}));
    process.env.GEMINI_API_KEY = 'test-key';
    ({ app, db } = setupTestApp());
    cookie = await login(app);
  });

  describe('POST /api/sessions', () => {
    it('kein Plan -> 409', async () => {
      const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      expect(res.status).toBe(409);
    });

    it('unbekannter day_key -> 422', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'nope' });
      expect(res.status).toBe(422);
    });

    it('neue Session -> 201', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        session_id: expect.any(Number),
        resumed: false,
        set_logs: [],
        rpe: [],
        note: null,
      });
    });

    it('zweiter Aufruf gleicher day_key < 24h -> 200 resumed:true mit set_logs', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const first = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      await request(app)
        .post(`/api/sessions/${first.body.session_id}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });

      const second = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      expect(second.status).toBe(200);
      expect(second.body.session_id).toBe(first.body.session_id);
      expect(second.body.resumed).toBe(true);
      expect(second.body.set_logs).toHaveLength(1);
    });

    it('aktive Session anderen day_keys wird discarded', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const first = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'pull' });

      const row = db.prepare('SELECT status FROM sessions WHERE id = ?').get(first.body.session_id);
      expect(row.status).toBe('discarded');
    });

    it('started_at > 24h -> neue Session, alte discarded', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const first = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });

      db.prepare("UPDATE sessions SET started_at = datetime('now', '-2 day') WHERE id = ?").run(
        first.body.session_id
      );

      const second = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      expect(second.status).toBe(201);
      expect(second.body.session_id).not.toBe(first.body.session_id);

      const oldRow = db.prepare('SELECT status FROM sessions WHERE id = ?').get(first.body.session_id);
      expect(oldRow.status).toBe('discarded');
    });
  });

  describe('POST /api/sessions/:id/sets', () => {
    async function createSession() {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      return res.body.session_id;
    }

    it('insert dann update auf gleichem key -> genau 1 row, neue Werte', async () => {
      const sessionId = await createSession();
      await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 8, weight_kg: null, duration_s: null });
      await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });

      const rows = db.prepare('SELECT * FROM set_logs WHERE session_id = ?').all(sessionId);
      expect(rows).toHaveLength(1);
      expect(rows[0].reps).toBe(10);
    });

    it('identischer Request 2x -> idempotent', async () => {
      const sessionId = await createSession();
      const body = { exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null };
      await request(app).post(`/api/sessions/${sessionId}/sets`).set('Cookie', cookie).send(body);
      await request(app).post(`/api/sessions/${sessionId}/sets`).set('Cookie', cookie).send(body);

      const rows = db.prepare('SELECT * FROM set_logs WHERE session_id = ?').all(sessionId);
      expect(rows).toHaveLength(1);
    });

    it('finished Session -> 409', async () => {
      const sessionId = await createSession();
      await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);

      const res = await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
      expect(res.status).toBe(409);
    });

    it('fremde Session -> 404', async () => {
      const sessionId = await createSession();
      const partnerCookie = await loginPartner(app);
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', partnerCookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
      expect(res.status).toBe(404);
    });

    it('reps und duration_s gleichzeitig -> 422', async () => {
      const sessionId = await createSession();
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: 30 });
      expect(res.status).toBe(422);
    });
  });

  describe('DELETE /api/sessions/:id/sets', () => {
    async function createSessionWithSet() {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      const sessionId = res.body.session_id;
      await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
      return sessionId;
    }

    it('entfernt gespeicherten Satz', async () => {
      const sessionId = await createSessionWithSet();
      const res = await request(app)
        .delete(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1 });
      expect(res.status).toBe(200);

      const rows = db.prepare('SELECT * FROM set_logs WHERE session_id = ?').all(sessionId);
      expect(rows).toHaveLength(0);
    });

    it('nicht vorhandener Satz -> 200 (idempotent)', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      const sessionId = res.body.session_id;

      const del = await request(app)
        .delete(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 99 });
      expect(del.status).toBe(200);
    });

    it('finished Session -> 409', async () => {
      const sessionId = await createSessionWithSet();
      await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);

      const res = await request(app)
        .delete(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1 });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/sessions/:id/finish', () => {
    async function createSession() {
      await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
      const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      return res.body.session_id;
    }

    it('setzt status/finished_at, legt Evaluation pending an', async () => {
      const sessionId = await createSession();
      await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });

      const res = await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.evaluation).toBe(true);
      expect(res.body.summary.exercises).toEqual([{ exercise_id: 'pu', sets: expect.any(Array) }]);

      const session = db.prepare('SELECT status, finished_at FROM sessions WHERE id = ?').get(sessionId);
      expect(session.status).toBe('finished');
      expect(session.finished_at).not.toBeNull();

      const evaluation = db.prepare('SELECT status FROM evaluations WHERE session_id = ?').get(sessionId);
      expect(evaluation.status).toBe('pending');
    });

    it('ohne Sets -> evaluation:false, keine Row', async () => {
      const sessionId = await createSession();
      const res = await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.evaluation).toBe(false);

      const evaluation = db.prepare('SELECT * FROM evaluations WHERE session_id = ?').get(sessionId);
      expect(evaluation).toBeUndefined();
    });

    it('doppeltes finish -> 409', async () => {
      const sessionId = await createSession();
      await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
      const res = await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
      expect(res.status).toBe(409);
    });
  });
});
