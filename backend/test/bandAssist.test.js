import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';
import { bandAssistKg, bodyweightAt, bodyweightShare, effectiveLoadKg, isBandAssisted } from 'shared/bandAssist';

const pullup = {
  id: 'band-assisted-pullup',
  name: 'Klimmzug mit Band',
  muscle: 'Rücken',
  type: 'bw',
  sets: 3,
  target_reps: '3-6',
  target_seconds: null,
  default_weight_kg: null,
  cue: 'cue',
  video_query: 'q',
};

const plan = {
  schema_version: 1,
  name: 'Band Plan',
  days: [{ key: 'pull', name: 'Pull', focus: 'Rücken', exercises: [pullup] }],
};

async function login(app) {
  const res = await request(app).post('/api/login').send({ email: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

async function finishSession(app, cookie, sets) {
  const { body } = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'pull' });
  for (const set of sets) {
    const res = await request(app).post(`/api/sessions/${body.session_id}/sets`).set('Cookie', cookie).send(set);
    expect(res.status).toBe(200);
  }
  await request(app).post(`/api/sessions/${body.session_id}/finish`).set('Cookie', cookie);
  return body.session_id;
}

describe('bandAssist model', () => {
  it('erkennt Band-Hilfe nur bei assistierten Körpergewichtsübungen', () => {
    expect(isBandAssisted(pullup)).toBe(true);
    expect(isBandAssisted({ id: 'band-pull-apart', name: 'Band Pull-Apart', type: 'bw' })).toBe(false);
    expect(isBandAssisted({ id: 'row', name: 'Rudern', type: 'wt' })).toBe(false);
  });

  it('3 × 36 kg helfen im Mittel mit 54 kg, nie mit 108 kg', () => {
    expect(bandAssistKg(3, 36)).toBe(54);
    expect(effectiveLoadKg(80, 3, 36)).toBe(26);
    // Mehr Hilfe als Körpergewicht: Last ist 0, nicht negativ.
    expect(effectiveLoadKg(60, 4, 36)).toBe(0);
    expect(effectiveLoadKg(null, 1, 36)).toBeNull();
  });

  it('% KG steigt mit weniger Bändern und mehr Wiederholungen', () => {
    const three = bodyweightShare(80, 3, 3, 36);
    const two = bodyweightShare(80, 3, 2, 36);
    const twoMoreReps = bodyweightShare(80, 6, 2, 36);
    expect(three).toBeLessThan(two);
    expect(two).toBeLessThan(twoMoreReps);
    expect(bodyweightShare(80, 1, 0, 36)).toBe(103); // ein Klimmzug ohne Band ≈ 100 %
  });

  it('Körpergewicht zum Datum: letzter Eintrag davor, sonst der früheste', () => {
    const rows = [{ date: '2026-08-01', value: 82 }, { date: '2026-09-01', value: 80 }];
    expect(bodyweightAt(rows, '2026-07-01')).toBe(82);
    expect(bodyweightAt(rows, '2026-08-15')).toBe(82);
    expect(bodyweightAt(rows, '2026-09-28 10:00:00')).toBe(80);
    expect(bodyweightAt([], '2026-09-28')).toBeNull();
  });
});

describe('band fields end to end', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    cookie = await login(app);
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan);
  });

  it('speichert Bänder pro Satz und liefert sie im Prefill zurück', async () => {
    await finishSession(app, cookie, [
      { exercise_id: pullup.id, set_number: 1, reps: 3, weight_kg: null, duration_s: null, band_count: 3, band_kg: 36 },
    ]);
    const res = await request(app).get('/api/history?day_key=pull').set('Cookie', cookie);
    expect(res.body.prefill[pullup.id][0]).toMatchObject({ reps: 3, band_count: 3, band_kg: 36 });
  });

  it('Fortschritt: Wdh. ohne Körpergewicht, % KG sobald es bekannt ist', async () => {
    await finishSession(app, cookie, [
      { exercise_id: pullup.id, set_number: 1, reps: 3, weight_kg: null, duration_s: null, band_count: 3, band_kg: 36 },
    ]);
    await finishSession(app, cookie, [
      { exercise_id: pullup.id, set_number: 1, reps: 3, weight_kg: null, duration_s: null, band_count: 2, band_kg: 36 },
    ]);

    let res = await request(app).get('/api/progress').set('Cookie', cookie);
    let ex = res.body.exercises.find((e) => e.exercise_id === pullup.id);
    expect(ex.metric_label).toBe('Wdh.');
    expect(ex.points.map((p) => p.value)).toEqual([3, 3]);

    await request(app).post('/api/max-tests').set('Cookie', cookie).send({ kind: 'bodyweight', value: 80 });
    res = await request(app).get('/api/progress').set('Cookie', cookie);
    ex = res.body.exercises.find((e) => e.exercise_id === pullup.id);
    expect(ex.metric_label).toBe('% KG');
    expect(ex.points[1].value).toBeGreaterThan(ex.points[0].value);
    expect(ex.trend).toBe('up');
  });

  it('lehnt negative Bandzahl ab', async () => {
    const { body } = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'pull' });
    const res = await request(app)
      .post(`/api/sessions/${body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: pullup.id, set_number: 1, reps: 3, weight_kg: null, duration_s: null, band_count: -1 });
    expect(res.status).toBe(422);
  });
});
