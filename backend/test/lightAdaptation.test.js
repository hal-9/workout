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
            sets: 3,
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

describe('Leichte Version via adaptations', () => {
  let app;
  let cookie;
  let sessionId;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    cookie = await login(app);
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
    const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    sessionId = res.body.session_id;
  });

  it('speichert light-Flag und liefert es über /sessions/recent zurück', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ light: true });
    expect(res.status).toBe(200);
    expect(res.body.adaptations).toEqual({ light: true });

    const recent = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
    expect(recent.body.active.adaptations).toEqual({ light: true });
  });

  it('light: false überschreibt ein aktives light-Flag', async () => {
    await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ light: true });
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ light: false });
    expect(res.status).toBe(200);

    const recent = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
    expect(recent.body.active.adaptations).toEqual({ light: false });
  });

  it('lehnt ungültiges light ab', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ light: 'ja' });
    expect(res.status).toBe(422);
  });
});
