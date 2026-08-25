import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';
import { buildAggregate } from '../src/evaluation.js';

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

function plan() {
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
  };
}

async function login(app) {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

async function waitForEvaluationStatus(db, sessionId, status, timeoutMs = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = db.prepare('SELECT * FROM evaluations WHERE session_id = ?').get(sessionId);
    if (row && row.status === status) return row;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`timeout waiting for evaluation status "${status}"`);
}

describe('evaluation', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    generateContentMock.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
    ({ app, db } = setupTestApp());
    cookie = await login(app);
  });

  async function createFinishedSession(dayKey = 'push', exerciseId = 'pu') {
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
    const session = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: dayKey });
    await request(app)
      .post(`/api/sessions/${session.body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: exerciseId, set_number: 1, reps: 10, weight_kg: null, duration_s: null });
    return session.body.session_id;
  }

  it('finish -> Evaluation wird ok mit summary_md (Mock-Antwort)', async () => {
    generateContentMock.mockResolvedValueOnce({ text: '## Gute Session' });
    const sessionId = await createFinishedSession();

    const res = await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
    expect(res.status).toBe(200);

    const row = await waitForEvaluationStatus(db, sessionId, 'ok');
    expect(row.summary_md).toBe('## Gute Session');
  });

  it('Mock wirft Fehler -> failed + error, finish-Response war trotzdem 200', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('api down'));
    const sessionId = await createFinishedSession();

    const res = await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
    expect(res.status).toBe(200);

    const row = await waitForEvaluationStatus(db, sessionId, 'failed');
    expect(row.error).toBe('api down');
  });

  it('fehlender GEMINI_API_KEY -> failed direkt', async () => {
    delete process.env.GEMINI_API_KEY;
    const sessionId = await createFinishedSession();

    await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
    const row = await waitForEvaluationStatus(db, sessionId, 'failed');
    expect(row.error).toBe('GEMINI_API_KEY not configured');
  });

  describe('buildAggregate', () => {
    it('nur gleicher day_key, max 5 previous, ohne aktuelle Session, bodyweight_log = letzte 5', () => {
      const testPlan = plan();
      db.prepare(
        'INSERT INTO plans (id, user_id, name, schema_version, json_payload, active) VALUES (1, 1, ?, 1, ?, 1)'
      ).run(testPlan.name, JSON.stringify(testPlan));

      const insertSession = db.prepare(
        `INSERT INTO sessions (id, user_id, plan_id, day_key, status, started_at, finished_at)
         VALUES (?, 1, 1, ?, 'finished', ?, ?)`
      );
      const insertLog = db.prepare(
        'INSERT INTO set_logs (session_id, exercise_id, set_number, reps) VALUES (?, ?, 1, 5)'
      );

      // 6 previous "push" sessions + 1 "pull" session that must be excluded
      for (let i = 1; i <= 6; i++) {
        insertSession.run(i, 'push', `2026-01-0${i} 10:00:00`, `2026-01-0${i} 10:30:00`);
        insertLog.run(i, 'pu');
      }
      insertSession.run(7, 'pull', '2026-01-07 10:00:00', '2026-01-07 10:30:00');
      insertLog.run(7, 'row');

      insertSession.run(8, 'push', '2026-01-08 10:00:00', null);
      insertLog.run(8, 'pu');
      const current = db.prepare('SELECT * FROM sessions WHERE id = 8').get();

      for (let i = 1; i <= 6; i++) {
        db.prepare('INSERT INTO max_tests (user_id, kind, value, date) VALUES (1, ?, ?, ?)').run(
          'bodyweight',
          80 + i,
          `2026-01-0${i}`
        );
      }

      const aggregate = buildAggregate(db, current, testPlan);

      expect(aggregate.day).toBe('Push');
      expect(aggregate.previous_sessions).toHaveLength(5);
      expect(aggregate.previous_sessions.every((s) => s.exercises[0].id === 'pu')).toBe(true);
      expect(aggregate.previous_sessions.some((s) => s.date === '2026-01-08')).toBe(false);
      expect(aggregate.bodyweight_log).toHaveLength(5);
      expect(aggregate.bodyweight_log[aggregate.bodyweight_log.length - 1].kg).toBe(86);
    });
  });

  describe('POST /api/sessions/:id/evaluate', () => {
    it('bei failed -> 202 und erneuter Call', async () => {
      generateContentMock.mockRejectedValueOnce(new Error('down'));
      const sessionId = await createFinishedSession();
      await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
      await waitForEvaluationStatus(db, sessionId, 'failed');

      generateContentMock.mockResolvedValueOnce({ text: 'ok now' });
      const res = await request(app).post(`/api/sessions/${sessionId}/evaluate`).set('Cookie', cookie);
      expect(res.status).toBe(202);
      expect(res.body).toEqual({ status: 'pending' });

      const row = await waitForEvaluationStatus(db, sessionId, 'ok');
      expect(row.summary_md).toBe('ok now');
    });

    it('bei pending -> 409', async () => {
      generateContentMock.mockImplementationOnce(() => new Promise(() => {}));
      const sessionId = await createFinishedSession();
      await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);

      const res = await request(app).post(`/api/sessions/${sessionId}/evaluate`).set('Cookie', cookie);
      expect(res.status).toBe(409);
    });

    it('bei ok -> 409', async () => {
      generateContentMock.mockResolvedValueOnce({ text: 'done' });
      const sessionId = await createFinishedSession();
      await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
      await waitForEvaluationStatus(db, sessionId, 'ok');

      const res = await request(app).post(`/api/sessions/${sessionId}/evaluate`).set('Cookie', cookie);
      expect(res.status).toBe(409);
    });

    it('ohne Evaluation -> 404', async () => {
      const res = await request(app).post('/api/sessions/999/evaluate').set('Cookie', cookie);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/sessions/:id/evaluation', () => {
    it('liefert alle drei Status-Formen', async () => {
      generateContentMock.mockImplementationOnce(() => new Promise(() => {}));
      const pendingSessionId = await createFinishedSession('push');
      await request(app).post(`/api/sessions/${pendingSessionId}/finish`).set('Cookie', cookie);

      const pendingRes = await request(app)
        .get(`/api/sessions/${pendingSessionId}/evaluation`)
        .set('Cookie', cookie);
      expect(pendingRes.body).toEqual({ status: 'pending' });

      generateContentMock.mockResolvedValueOnce({ text: 'summary text' });
      const okSessionId = await createFinishedSession('pull', 'row');
      await request(app).post(`/api/sessions/${okSessionId}/finish`).set('Cookie', cookie);
      await waitForEvaluationStatus(db, okSessionId, 'ok');

      const okRes = await request(app).get(`/api/sessions/${okSessionId}/evaluation`).set('Cookie', cookie);
      expect(okRes.body).toEqual({ status: 'ok', summary_md: 'summary text' });

      generateContentMock.mockRejectedValueOnce(new Error('boom'));
      const failedSessionId = await createFinishedSession('push');
      await request(app).post(`/api/sessions/${failedSessionId}/finish`).set('Cookie', cookie);
      await waitForEvaluationStatus(db, failedSessionId, 'failed');

      const failedRes = await request(app)
        .get(`/api/sessions/${failedSessionId}/evaluation`)
        .set('Cookie', cookie);
      expect(failedRes.body).toEqual({ status: 'failed', error: 'boom' });
    });

    it('ohne Evaluation -> 404', async () => {
      const res = await request(app).get('/api/sessions/999/evaluation').set('Cookie', cookie);
      expect(res.status).toBe(404);
    });
  });
});
