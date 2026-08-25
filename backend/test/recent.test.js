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
        name: 'Push & Core',
        focus: 'Brust',
        exercises: [
          {
            id: 'pu',
            name: 'Push-Up',
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
            name: 'Row',
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

async function login(app, email = 'tuncay@example.com', password = 'password1') {
  const res = await request(app).post('/api/login').send({ email, password });
  return res.headers['set-cookie'][0];
}

describe('GET /api/sessions/recent + /api/sessions/:id/summary', () => {
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

  async function finishedSession(dayKey, { withSet = true } = {}) {
    const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: dayKey });
    const id = res.body.session_id;
    if (withSet) {
      const body =
        dayKey === 'pull'
          ? { exercise_id: 'row', set_number: 1, reps: 10, weight_kg: 12, duration_s: null }
          : { exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null };
      await request(app).post(`/api/sessions/${id}/sets`).set('Cookie', cookie).send(body);
    }
    await request(app).post(`/api/sessions/${id}/finish`).set('Cookie', cookie);
    return id;
  }

  describe('recent', () => {
    it('nur finished Sessions, absteigend nach finished_at', async () => {
      const a = await finishedSession('push');
      const b = await finishedSession('pull');
      db.prepare("UPDATE sessions SET finished_at = datetime('now','-1 day') WHERE id = ?").run(a);
      // aktive Session darf nicht in der Liste auftauchen
      await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });

      const res = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.sessions.map((s) => s.session_id)).toEqual([b, a]);
    });

    it('discarded Sessions tauchen nicht auf', async () => {
      const first = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'pull' });

      const res = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
      const ids = res.body.sessions.map((s) => s.session_id);
      expect(ids).not.toContain(first.body.session_id);
    });

    it('limit wird respektiert und geclampt', async () => {
      await finishedSession('push');
      await finishedSession('pull');

      const res = await request(app).get('/api/sessions/recent?limit=1').set('Cookie', cookie);
      expect(res.body.sessions).toHaveLength(1);

      const clamped = await request(app).get('/api/sessions/recent?limit=999').set('Cookie', cookie);
      expect(clamped.status).toBe(200);
    });

    it('evaluation_status: pending bei Sets, null ohne Sets, failed nach Fehler', async () => {
      const withSets = await finishedSession('push');
      const withoutSets = await finishedSession('pull', { withSet: false });
      const failed = await finishedSession('pull');
      db.prepare("UPDATE evaluations SET status = 'failed' WHERE session_id = ?").run(failed);

      const res = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
      const byId = Object.fromEntries(res.body.sessions.map((s) => [s.session_id, s.evaluation_status]));
      expect(byId[withSets]).toBe('pending');
      expect(byId[withoutSets]).toBeNull();
      expect(byId[failed]).toBe('failed');
    });

    it('day_name kommt aus dem Plan der Session, auch nach neuem Plan-Import', async () => {
      const id = await finishedSession('push');
      await request(app)
        .post('/api/plan')
        .set('Cookie', cookie)
        .send(plan({ days: plan().days.map((d) => ({ ...d, name: `NEU ${d.name}` })) }));

      const res = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
      const entry = res.body.sessions.find((s) => s.session_id === id);
      expect(entry.day_name).toBe('Push & Core');
    });

    it('active enthält jüngste aktive Session mit set_logs, sonst null', async () => {
      const empty = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
      expect(empty.body.active).toBeNull();

      const created = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      await request(app)
        .post(`/api/sessions/${created.body.session_id}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 9, weight_kg: null, duration_s: null });

      const res = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
      expect(res.body.active.session_id).toBe(created.body.session_id);
      expect(res.body.active.day_key).toBe('push');
      expect(res.body.active.set_logs).toHaveLength(1);
    });

    it('fremde Sessions sind unsichtbar', async () => {
      await finishedSession('push');
      const partnerCookie = await login(app, 'partnerin@example.com', 'password2');

      const res = await request(app).get('/api/sessions/recent').set('Cookie', partnerCookie);
      expect(res.body.sessions).toHaveLength(0);
      expect(res.body.active).toBeNull();
    });
  });

  describe('summary', () => {
    it('gruppiert Sets je Übung mit Namen aus dem Plan', async () => {
      const id = await finishedSession('push');

      const res = await request(app).get(`/api/sessions/${id}/summary`).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.day_name).toBe('Push & Core');
      expect(res.body.evaluation).toBe(true);
      expect(res.body.summary.exercises).toEqual([
        { exercise_id: 'pu', name: 'Push-Up', sets: [expect.objectContaining({ set_number: 1, reps: 10 })] },
      ]);
    });

    it('evaluation:false bei Session ohne Sätze', async () => {
      const id = await finishedSession('push', { withSet: false });

      const res = await request(app).get(`/api/sessions/${id}/summary`).set('Cookie', cookie);
      expect(res.body.evaluation).toBe(false);
      expect(res.body.summary.exercises).toEqual([]);
    });

    it('fremde Session -> 404, unbekannte id -> 404', async () => {
      const id = await finishedSession('push');
      const partnerCookie = await login(app, 'partnerin@example.com', 'password2');

      const foreign = await request(app).get(`/api/sessions/${id}/summary`).set('Cookie', partnerCookie);
      expect(foreign.status).toBe(404);

      const unknown = await request(app).get('/api/sessions/99999/summary').set('Cookie', cookie);
      expect(unknown.status).toBe(404);
    });
  });
});
