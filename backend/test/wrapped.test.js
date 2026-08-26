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

describe('Wrapped (Monats-Rückblick)', () => {
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
    db.prepare('UPDATE sessions SET finished_at = ?, started_at = ? WHERE id = ?').run(finishedAt, finishedAt, sid);
    return sid;
  }

  it('aggregiert Monat inkl. Vormonats-Vergleich, Top-PR und Top-Zone', async () => {
    await finishedSession(40, '2026-06-10 10:00:00'); // Baseline für PR-Erkennung
    await finishedSession(40, '2026-07-02 10:00:00'); // Vormonat: 640 kg
    await finishedSession(45, '2026-08-04 10:00:00'); // Zielmonat: PR (45 > 40)
    await finishedSession(45, '2026-08-12 10:00:00');

    const res = await request(app).get('/api/wrapped?month=2026-08').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      month: '2026-08',
      workouts: 2,
      weeks_grown: 2,
      tonnage_kg: 1440,
      tonnage_prev_kg: 640,
      top_pr: { name: 'Bankdrücken', kind: 'weight', value: 45, previous: 40 },
      top_zone: { zone: 'brust', label: 'Brust' },
    });
  });

  it('latest + seen-Flow', async () => {
    // wrappedStatus schaut auf den Vormonat (relativ zu jetzt) — Session dorthin datieren
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
    const ts = `${prev.toISOString().slice(0, 10)} 10:00:00`;
    await finishedSession(40, ts);

    const latest = await request(app).get('/api/wrapped/latest').set('Cookie', cookie);
    expect(latest.status).toBe(200);
    expect(latest.body.available).toBe(true);
    expect(latest.body.seen).toBe(false);
    const month = latest.body.month;

    await request(app).post(`/api/wrapped/${month}/seen`).set('Cookie', cookie);
    const after = await request(app).get('/api/wrapped/latest').set('Cookie', cookie);
    expect(after.body.seen).toBe(true);
  });

  it('validiert den Monats-Parameter', async () => {
    const res = await request(app).get('/api/wrapped?month=august').set('Cookie', cookie);
    expect(res.status).toBe(422);
    const seen = await request(app).post('/api/wrapped/13-2026/seen').set('Cookie', cookie);
    expect(seen.status).toBe(422);
  });
});
