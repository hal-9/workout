import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { evaluateExercise, progressionConfig, unavailableKey } from 'shared/progression';
import { setupTestApp } from './helpers.js';

// Kurzhantel-Rudern: 10 kg, Ziel 8-15 Wdh., zweimal alle Sätze am oberen Ende.
const rudern = (overrides = {}) => ({
  id: 'row',
  name: 'Rudern',
  muscle: 'Rücken',
  type: 'wt',
  equipment: 'kurzhantel',
  sets: 2,
  target_reps: '8-15',
  target_seconds: null,
  default_weight_kg: 10,
  cue: '',
  video_query: '',
  ...overrides,
});
const top = (reps = 15, kg = 10) => ({ sets: [1, 2].map((n) => ({ set_number: n, reps, weight_kg: kg })) });

describe('Progression in Geräte-Schritten', () => {
  it('Schritt kommt vom Gerät: Kurzhantel 2,5 kg, Maschine 5 kg', () => {
    expect(progressionConfig(rudern()).increment).toBe(2.5);
    expect(progressionConfig(rudern({ equipment: 'maschine' })).increment).toBe(5);
  });

  it('expliziter Plan-Schritt gewinnt', () => {
    expect(progressionConfig(rudern({ progression: { increment: 1 } })).increment).toBe(1);
  });

  it('schlägt das nächste Gewicht im Schritt vor: 10 → 12,5 kg', () => {
    expect(evaluateExercise(rudern(), [top(), top()])).toMatchObject({ field: 'default_weight_kg', from: 10, to: 12.5 });
  });

  it('12,5 kg nicht vorhanden → eine Wiederholung mehr mit 10 kg, nie 12,5 oder 15 kg', () => {
    const unavailable = new Set([unavailableKey(rudern(), 12.5)]);
    const proposal = evaluateExercise(rudern(), [top(), top()], unavailable);
    expect(proposal).toMatchObject({ field: 'target_reps', from: '8-15', to: '8-16', unavailable_kg: 12.5 });
    expect(proposal.rationale).toContain('12,5 kg nicht vorhanden');
  });

  it('nicht vorhanden gilt fürs Gerät, nicht für andere Geräte', () => {
    const unavailable = new Set([unavailableKey(rudern(), 12.5)]);
    const kabel = rudern({ equipment: 'kabelzug' });
    expect(evaluateExercise(kabel, [top(), top()], unavailable)).toMatchObject({ field: 'default_weight_kg', to: 12.5 });
  });
});

describe('POST /api/progression/unavailable', () => {
  let app;
  let cookie;

  const plan = () => ({
    schema_version: 1,
    name: 'Test',
    days: [{ key: 'pull', name: 'Pull', focus: 'Rücken', exercises: [rudern()] }],
  });

  async function workout(reps, kg) {
    const s = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'pull' });
    for (const n of [1, 2]) {
      await request(app)
        .post(`/api/sessions/${s.body.session_id}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'row', set_number: n, reps, weight_kg: kg, duration_s: null });
    }
    await request(app).post(`/api/sessions/${s.body.session_id}/finish`).set('Cookie', cookie).send({});
  }

  beforeEach(async () => {
    ({ app } = setupTestApp());
    const res = await request(app).post('/api/login').send({ email: 'tuncay@example.com', password: 'password1' });
    cookie = res.headers['set-cookie'][0];
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
    await workout(15, 10);
    await workout(15, 10);
  });

  it('merkt das Gewicht und liefert danach den Wdh.-Vorschlag; Übernehmen ergibt 16 Wdh. mit 10 kg', async () => {
    let res = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(res.body.proposals[0]).toMatchObject({ field: 'default_weight_kg', to: 12.5 });

    res = await request(app).post('/api/progression/unavailable').set('Cookie', cookie).send({ exercise_id: 'row' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ equipment: 'kurzhantel', weight_kg: 12.5 });

    res = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(res.body.proposals[0]).toMatchObject({ field: 'target_reps', to: '8-16' });

    await request(app).post('/api/progression/apply').set('Cookie', cookie).send({ exercise_ids: ['row'] });
    res = await request(app).get('/api/history?day_key=pull').set('Cookie', cookie);
    expect(res.body.targets.row.map((r) => [r.reps, r.weight_kg])).toEqual([[16, 10], [16, 10]]);
  });

  it('Liste und Wieder-da: danach wird 12,5 kg wieder vorgeschlagen', async () => {
    await request(app).post('/api/progression/unavailable').set('Cookie', cookie).send({ exercise_id: 'row' });
    let res = await request(app).get('/api/progression/unavailable').set('Cookie', cookie);
    expect(res.body.weights).toEqual([{ equipment: 'kurzhantel', weight_kg: 12.5 }]);

    res = await request(app)
      .delete('/api/progression/unavailable')
      .set('Cookie', cookie)
      .send({ equipment: 'kurzhantel', weight_kg: 12.5 });
    expect(res.status).toBe(204);
    res = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(res.body.proposals[0]).toMatchObject({ field: 'default_weight_kg', to: 12.5 });
  });

  it('ohne offenen Gewichtsvorschlag: 409, nichts gespeichert', async () => {
    const res = await request(app).post('/api/progression/unavailable').set('Cookie', cookie).send({ exercise_id: 'nope' });
    expect(res.status).toBe(409);
  });

  it('gehört dem Nutzer: andere sehen die Liste nicht', async () => {
    await request(app).post('/api/progression/unavailable').set('Cookie', cookie).send({ exercise_id: 'row' });
    const other = await request(app).post('/api/login').send({ email: 'partnerin@example.com', password: 'password2' });
    const res = await request(app).get('/api/progression/unavailable').set('Cookie', other.headers['set-cookie'][0]);
    expect(res.body.weights).toEqual([]);
  });
});
