import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { evaluateExercise } from 'shared/progression';
import { localDay, nextMondayKey } from '../src/progression.js';
import { setupTestApp } from './helpers.js';

function ex(overrides = {}) {
  return {
    id: 'bench',
    name: 'Bankdrücken',
    muscle: 'Brust',
    type: 'wt',
    sets: 3,
    target_reps: '8-12',
    target_seconds: null,
    default_weight_kg: 40,
    cue: '',
    video_query: '',
    ...overrides,
  };
}

const apiPlan = () => ({
  schema_version: 1,
  name: 'Test Plan',
  days: [{ key: 'push', name: 'Push', focus: 'Brust', exercises: [ex()] }],
});

const topApiSets = (weight = 40) =>
  [1, 2, 3].map((set_number) => ({ exercise_id: 'bench', set_number, reps: 12, weight_kg: weight, duration_s: null }));

async function login(app) {
  const res = await request(app).post('/api/login').send({ email: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

async function finishSession(app, cookie, sets) {
  const s = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
  for (const set of sets) {
    await request(app).post(`/api/sessions/${s.body.session_id}/sets`).set('Cookie', cookie).send(set);
  }
  await request(app).post(`/api/sessions/${s.body.session_id}/finish`).set('Cookie', cookie).send({});
}

describe('nextMondayKey', () => {
  it('liefert den kommenden Montag', () => {
    // 2026-09-01 ist ein Dienstag (Berlin) -> 2026-09-07
    expect(nextMondayKey(Date.parse('2026-09-01T10:00:00Z'))).toBe('2026-09-07');
    // An einem Montag zeigt er auf den Montag danach, der laufende Tag ist also frei
    expect(nextMondayKey(Date.parse('2026-08-31T10:00:00Z'))).toBe('2026-09-07');
    // Sonntag -> direkt der nächste Tag
    expect(nextMondayKey(Date.parse('2026-09-06T12:00:00Z'))).toBe('2026-09-07');
    // Berliner Grenze: 22:00 UTC am Sonntag ist dort schon Montag
    expect(nextMondayKey(Date.parse('2026-09-06T22:00:00Z'))).toBe('2026-09-14');
  });

  it('ist immer ein Datum nach heute', () => {
    expect(nextMondayKey() > localDay()).toBe(true);
  });
});

describe('Proposal-Belege', () => {
  it('liefert die Sätze der Serie mit Datum', () => {
    const session = (id) => ({
      session_id: id,
      finished_at: '2026-08-31 18:00:00',
      sets: [1, 2, 3].map(() => ({ reps: 12, weight_kg: 40, duration_s: null })),
    });
    const proposal = evaluateExercise(ex(), [session(1), session(2)]);
    expect(proposal.evidence).toHaveLength(2);
    expect(proposal.evidence[0]).toMatchObject({ session_id: 1, finished_at: '2026-08-31 18:00:00' });
    expect(proposal.evidence[0].sets).toEqual([
      { reps: 12, weight_kg: 40, duration_s: null },
      { reps: 12, weight_kg: 40, duration_s: null },
      { reps: 12, weight_kg: 40, duration_s: null },
    ]);
  });

  it('begrenzt die Belege auf die geplanten Sätze', () => {
    const session = (id) => ({
      session_id: id,
      finished_at: null,
      sets: [1, 2, 3, 4].map(() => ({ reps: 12, weight_kg: 40, duration_s: null })),
    });
    const proposal = evaluateExercise(ex({ sets: 2 }), [session(1), session(2)]);
    expect(proposal.evidence[0].sets).toHaveLength(2);
  });
});

describe('Snooze API', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    cookie = await login(app);
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
    await finishSession(app, cookie, topApiSets());
    await finishSession(app, cookie, topApiSets());
  });

  it('verschiebt einen Vorschlag bis zum nächsten Montag', async () => {
    const res = await request(app)
      .post('/api/progression/snooze')
      .set('Cookie', cookie)
      .send({ exercise_ids: ['bench'] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ snoozed_until: nextMondayKey(), exercise_ids: ['bench'] });

    const after = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(after.body.proposals).toEqual([]);
  });

  it('zeigt den Vorschlag nach Ablauf wieder und räumt die Zeile auf', async () => {
    await request(app).post('/api/progression/snooze').set('Cookie', cookie).send({ exercise_ids: ['bench'] });
    db.prepare('UPDATE progression_snoozes SET until_date = ? WHERE user_id = 1').run(localDay());

    const after = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(after.body.proposals).toHaveLength(1);
    expect(db.prepare('SELECT COUNT(*) AS n FROM progression_snoozes').get().n).toBe(0);
  });

  it('übernehmen löscht einen bestehenden Snooze', async () => {
    await request(app).post('/api/progression/snooze').set('Cookie', cookie).send({ exercise_ids: ['bench'] });
    await request(app).post('/api/progression/apply').set('Cookie', cookie).send({ exercise_ids: ['bench'] });
    expect(db.prepare('SELECT COUNT(*) AS n FROM progression_snoozes').get().n).toBe(0);
  });

  it('snooze ohne offenen Vorschlag -> 409, Body-Fehler -> 422, ohne Cookie -> 401', async () => {
    expect(
      (await request(app).post('/api/progression/snooze').set('Cookie', cookie).send({ exercise_ids: ['nope'] })).status
    ).toBe(409);
    expect((await request(app).post('/api/progression/snooze').set('Cookie', cookie).send({})).status).toBe(422);
    expect((await request(app).post('/api/progression/snooze').send({ exercise_ids: ['bench'] })).status).toBe(401);
  });

  it('Snoozes sind pro Nutzer isoliert', async () => {
    await request(app).post('/api/progression/snooze').set('Cookie', cookie).send({ exercise_ids: ['bench'] });
    const other = await request(app)
      .post('/api/login')
      .send({ email: 'partnerin@example.com', password: 'password2' });
    const otherCookie = other.headers['set-cookie'][0];
    await request(app).post('/api/plan').set('Cookie', otherCookie).send(apiPlan());
    expect(
      (await request(app).post('/api/progression/snooze').set('Cookie', otherCookie).send({ exercise_ids: ['bench'] }))
        .status
    ).toBe(409); // keine Sessions -> kein offener Vorschlag
    expect(db.prepare('SELECT user_id FROM progression_snoozes').all()).toEqual([{ user_id: 1 }]);
  });
});
