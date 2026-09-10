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
            zones: { primary: ['brust'], secondary: ['trizeps'] },
          },
        ],
      },
    ],
  };
}

// Ersatz mit eigener Id — wie ihn der Tausch-Dialog aus der Bibliothek ableitet.
const pushup = {
  id: 'a-pushup',
  name: 'Liegestütze',
  muscle: 'Brust · Trizeps',
  type: 'bw',
  sets: 3,
  target_reps: '8-15',
  target_seconds: null,
  default_weight_kg: null,
  cue: 'Körper eine Linie.',
  video_query: 'Liegestütze Technik',
  phase: 'main',
  zones: { primary: ['brust'], secondary: ['trizeps', 'schultern_vorn', 'core'] },
  equipment: 'koerpergewicht',
  pattern: 'push_horizontal',
};

async function login(app) {
  const res = await request(app)
    .post('/api/login')
    .send({ name: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

describe('Übungs-Tausch via adaptations.replaced', () => {
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

  it('speichert den Tausch und liefert ihn beim Resume zurück', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ replaced: [{ original_id: 'bp', exercise: pushup }] });
    expect(res.status).toBe(200);
    expect(res.body.adaptations.replaced[0].exercise.id).toBe('a-pushup');

    const recent = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
    expect(recent.body.active.adaptations.replaced).toHaveLength(1);
    expect(recent.body.active.adaptations.replaced[0].original_id).toBe('bp');
  });

  it('mergt mit „leichter Version" statt sie zu überschreiben', async () => {
    await request(app).post(`/api/sessions/${sessionId}/adaptations`).set('Cookie', cookie).send({ light: true });
    await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ replaced: [{ original_id: 'bp', exercise: pushup }] });
    const res = await request(app).post(`/api/sessions/${sessionId}/adaptations`).set('Cookie', cookie).send({ light: false });
    expect(res.body.adaptations.light).toBe(false);
    expect(res.body.adaptations.replaced).toHaveLength(1);
  });

  it('lehnt einen Ersatz ohne gültige Übung ab', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ replaced: [{ original_id: 'bp', exercise: { id: 'x' } }] });
    expect(res.status).toBe(422);
  });

  it('Summary kennt den Namen der getauschten Übung', async () => {
    await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ replaced: [{ original_id: 'bp', exercise: pushup }] });
    await request(app)
      .post(`/api/sessions/${sessionId}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'a-pushup', set_number: 1, reps: 12, weight_kg: null, duration_s: null });
    await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie).send({});

    const res = await request(app).get(`/api/sessions/${sessionId}/summary`).set('Cookie', cookie);
    expect(res.body.summary.exercises).toEqual([
      { exercise_id: 'a-pushup', name: 'Liegestütze', sets: expect.any(Array) },
    ]);
  });

  it('Statistik zählt Sätze der getauschten Übung mit', async () => {
    await request(app)
      .post(`/api/sessions/${sessionId}/adaptations`)
      .set('Cookie', cookie)
      .send({ replaced: [{ original_id: 'bp', exercise: pushup }] });
    await request(app)
      .post(`/api/sessions/${sessionId}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'a-pushup', set_number: 1, reps: 12, weight_kg: null, duration_s: null });
    await request(app)
      .post(`/api/sessions/${sessionId}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'a-pushup', set_number: 2, reps: 10, weight_kg: null, duration_s: null });
    await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie).send({});

    const stats = await request(app).get('/api/stats').set('Cookie', cookie);
    expect(stats.status).toBe(200);
    expect(stats.body.sessions[0].sets).toBe(2);
    expect(stats.body.volume_by_muscle.find((m) => m.muscle === 'Brust · Trizeps')?.sets).toBe(2);
  });

  it('/history liefert Prefill für zusätzliche Ids', async () => {
    await request(app)
      .post(`/api/sessions/${sessionId}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'a-pushup', set_number: 1, reps: 12, weight_kg: null, duration_s: null });
    await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie).send({});

    const plain = await request(app).get('/api/history?day_key=push').set('Cookie', cookie);
    expect(plain.body.prefill['a-pushup']).toBeUndefined();

    const withExtra = await request(app)
      .get('/api/history?day_key=push&exercise_ids=a-pushup,unknown')
      .set('Cookie', cookie);
    expect(withExtra.body.prefill['a-pushup']).toEqual([
      { set_number: 1, reps: 12, weight_kg: null, duration_s: null },
    ]);
    expect(withExtra.body.prefill.unknown).toBeUndefined();
  });
});
