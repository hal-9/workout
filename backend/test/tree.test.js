import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

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
            id: 'bp',
            name: 'Bankdrücken',
            muscle: 'Brust',
            type: 'wt',
            sets: 2,
            target_reps: '8-12',
            target_seconds: null,
            default_weight_kg: 40,
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
    .send({ name: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

describe('GET /api/stats/tree', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    cookie = await login(app);
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
  });

  async function finishedSession(weightKg, finishedAt) {
    const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    const sid = res.body.session_id;
    for (const setNumber of [1, 2]) {
      await request(app)
        .post(`/api/sessions/${sid}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'bp', set_number: setNumber, reps: 8, weight_kg: weightKg, duration_s: null });
    }
    await request(app).post(`/api/sessions/${sid}/finish`).set('Cookie', cookie).send({});
    db.prepare('UPDATE sessions SET finished_at = ?, started_at = ? WHERE id = ?').run(
      finishedAt,
      finishedAt,
      sid
    );
    return sid;
  }

  it('aggregiert Workouts, Tonnage, PRs und Max-Tests pro UTC-Woche', async () => {
    // Woche 1 (Mo 2026-08-10): erste Session — zählt nie als PR
    await finishedSession(40, '2026-08-10 10:00:00');
    // Woche 2 (Mo 2026-08-17): schwerer — genau 1 PR
    await finishedSession(45, '2026-08-18 10:00:00');
    await request(app)
      .post('/api/max-tests')
      .set('Cookie', cookie)
      .send({ kind: 'pushups', value: 30, date: '2026-08-19' });

    const res = await request(app).get('/api/stats/tree').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.weeks).toEqual([
      { week_start: '2026-08-10', workouts: 1, tonnage_kg: 640, prs: 0, max_tests: 0 },
      { week_start: '2026-08-17', workouts: 1, tonnage_kg: 720, prs: 1, max_tests: 1 },
    ]);
  });

  it('leere Historie liefert leere Wochenliste', async () => {
    const res = await request(app).get('/api/stats/tree').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.weeks).toEqual([]);
  });
});
