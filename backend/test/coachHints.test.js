import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: vi.fn().mockRejectedValue(new Error('offline')) },
  })),
}));

const plan = {
  schema_version: 1,
  name: 'Test',
  days: [
    {
      key: 'push',
      name: 'Push',
      focus: 'Brust',
      exercises: [
        { id: 'pu', name: 'Liegestütze', muscle: 'Brust', type: 'bw', sets: 3, target_reps: '8-12', target_seconds: null, default_weight_kg: null, cue: 'c', video_query: 'q' },
        { id: 'bp', name: 'Bankdrücken', muscle: 'Brust', type: 'wt', sets: 3, target_reps: '8-12', target_seconds: null, default_weight_kg: 40, cue: 'c', video_query: 'q' },
      ],
    },
  ],
};

describe('coach hints', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    delete process.env.GEMINI_API_KEY;
    ({ app } = setupTestApp());
    const res = await request(app).post('/api/login').send({ email: 'tuncay@example.com', password: 'password1' });
    cookie = res.headers['set-cookie'];
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan);
  });

  async function finishedSession() {
    const session = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    const id = session.body.session_id;
    await request(app).post(`/api/sessions/${id}/sets`).set('Cookie', cookie)
      .send({ exercise_id: 'bp', set_number: 1, reps: 10, weight_kg: 40, duration_s: null });
    await request(app).post(`/api/sessions/${id}/finish`).set('Cookie', cookie);
    return id;
  }

  it('speichert Tipps, /history liefert sie, nächster Finish mit der Übung löscht sie', async () => {
    const sourceId = await finishedSession();

    const save = await request(app).post('/api/coach/hints').set('Cookie', cookie).send({
      session_id: sourceId,
      hints: [
        { exercise_id: 'bp', field: 'weight_kg', value: 42.5 },
        { exercise_id: 'pu', field: 'reps', value: 12 },
      ],
    });
    expect(save.status).toBe(201);

    const history = await request(app).get('/api/history?day_key=push').set('Cookie', cookie);
    expect(history.body.hints).toEqual({ bp: { weight_kg: 42.5 }, pu: { reps: 12 } });

    // Nächste Session loggt nur Bankdrücken → nur dieser Tipp ist verbraucht.
    await finishedSession();
    const after = await request(app).get('/api/history?day_key=push').set('Cookie', cookie);
    expect(after.body.hints).toEqual({ pu: { reps: 12 } });
  });

  it('gleiche Übung + Feld überschreibt statt zu verdoppeln', async () => {
    const sourceId = await finishedSession();
    for (const value of [42.5, 45]) {
      await request(app).post('/api/coach/hints').set('Cookie', cookie)
        .send({ session_id: sourceId, hints: [{ exercise_id: 'bp', field: 'weight_kg', value }] });
    }
    const history = await request(app).get('/api/history?day_key=push').set('Cookie', cookie);
    expect(history.body.hints).toEqual({ bp: { weight_kg: 45 } });
  });

  it('lehnt Feld ab, das nicht zum Übungstyp passt, und fremde Ids', async () => {
    const sourceId = await finishedSession();
    const wrongField = await request(app).post('/api/coach/hints').set('Cookie', cookie)
      .send({ session_id: sourceId, hints: [{ exercise_id: 'pu', field: 'weight_kg', value: 10 }] });
    expect(wrongField.status).toBe(422);

    const unknown = await request(app).post('/api/coach/hints').set('Cookie', cookie)
      .send({ session_id: sourceId, hints: [{ exercise_id: 'ghost', field: 'reps', value: 10 }] });
    expect(unknown.status).toBe(422);

    const foreign = await request(app).post('/api/coach/hints').set('Cookie', cookie)
      .send({ session_id: 999, hints: [{ exercise_id: 'bp', field: 'weight_kg', value: 42.5 }] });
    expect(foreign.status).toBe(404);
  });
});
