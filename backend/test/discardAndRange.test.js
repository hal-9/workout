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
    .send({ email: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

async function loginPartner(app) {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'partnerin@example.com', password: 'password2' });
  return res.headers['set-cookie'][0];
}

function sqlUtc(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function finishedSession(app, cookie, dayKey = 'push', exerciseId = 'pu', reps = 10) {
  const created = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: dayKey });
  const sessionId = created.body.session_id;
  await request(app)
    .post(`/api/sessions/${sessionId}/sets`)
    .set('Cookie', cookie)
    .send({ exercise_id: exerciseId, set_number: 1, reps, weight_kg: null, duration_s: null });
  await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
  return sessionId;
}

describe('discard & range', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    generateContentMock.mockReset();
    generateContentMock.mockImplementation(() => new Promise(() => {}));
    process.env.GEMINI_API_KEY = 'test-key';
    ({ app, db } = setupTestApp());
    cookie = await login(app);
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
  });

  describe('POST /api/sessions/:id/discard', () => {
    it('finished Session -> 200, verschwindet aus recent, set_logs bleiben', async () => {
      const sessionId = await finishedSession(app, cookie);

      const res = await request(app).post(`/api/sessions/${sessionId}/discard`).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });

      const recent = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
      expect(recent.body.sessions.some((s) => s.session_id === sessionId)).toBe(false);

      const row = db.prepare('SELECT status FROM sessions WHERE id = ?').get(sessionId);
      expect(row.status).toBe('discarded');

      const logs = db.prepare('SELECT COUNT(*) c FROM set_logs WHERE session_id = ?').get(sessionId);
      expect(logs.c).toBe(1);
    });

    it('aktive Session -> 409', async () => {
      const created = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      const res = await request(app)
        .post(`/api/sessions/${created.body.session_id}/discard`)
        .set('Cookie', cookie);
      expect(res.status).toBe(409);
    });

    it('bereits discarded -> 409', async () => {
      const sessionId = await finishedSession(app, cookie);
      await request(app).post(`/api/sessions/${sessionId}/discard`).set('Cookie', cookie);
      const res = await request(app).post(`/api/sessions/${sessionId}/discard`).set('Cookie', cookie);
      expect(res.status).toBe(409);
    });

    it('fremde Session -> 404', async () => {
      const sessionId = await finishedSession(app, cookie);
      const partnerCookie = await loginPartner(app);
      const res = await request(app).post(`/api/sessions/${sessionId}/discard`).set('Cookie', partnerCookie);
      expect(res.status).toBe(404);
    });

    it('discarded Session liefert kein Prefill mehr', async () => {
      const sessionId = await finishedSession(app, cookie, 'push', 'pu', 10);
      await request(app).post(`/api/sessions/${sessionId}/discard`).set('Cookie', cookie);

      const history = await request(app).get('/api/history?day_key=push').set('Cookie', cookie);
      expect(history.body.prefill.pu ?? []).toHaveLength(0);
    });
  });

  describe('GET /api/sessions?from=&to=', () => {
    it('liefert finished Sessions im Bereich', async () => {
      const sessionId = await finishedSession(app, cookie);

      const res = await request(app)
        .get('/api/sessions')
        .query({ from: sqlUtc(-1), to: sqlUtc(1) })
        .set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
      expect(res.body.sessions[0]).toMatchObject({
        session_id: sessionId,
        day_key: 'push',
        day_name: 'Push',
      });
      expect(res.body.sessions[0].finished_at).toEqual(expect.any(String));
    });

    it('discarded und außerhalb des Bereichs ausgeschlossen', async () => {
      const discardedId = await finishedSession(app, cookie, 'push');
      await request(app).post(`/api/sessions/${discardedId}/discard`).set('Cookie', cookie);
      const keptId = await finishedSession(app, cookie, 'pull', 'row');

      const inRange = await request(app)
        .get('/api/sessions')
        .query({ from: sqlUtc(-1), to: sqlUtc(1) })
        .set('Cookie', cookie);
      expect(inRange.body.sessions.map((s) => s.session_id)).toEqual([keptId]);

      const outOfRange = await request(app)
        .get('/api/sessions')
        .query({ from: sqlUtc(-3), to: sqlUtc(-2) })
        .set('Cookie', cookie);
      expect(outOfRange.body.sessions).toHaveLength(0);
    });

    it('fehlendes/fehlerhaftes from -> 422', async () => {
      const missing = await request(app).get('/api/sessions').query({ to: sqlUtc(1) }).set('Cookie', cookie);
      expect(missing.status).toBe(422);

      const malformed = await request(app)
        .get('/api/sessions')
        .query({ from: '2026-07-05', to: sqlUtc(1) })
        .set('Cookie', cookie);
      expect(malformed.status).toBe(422);
    });
  });
});
