import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';
import { buildAggregate } from '../src/evaluation.js';

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
          { id: 'bench', name: 'Bankdrücken', muscle: 'Brust', type: 'wt', sets: 3, target_reps: '8-12', target_seconds: null, default_weight_kg: 40, cue: '', video_query: '' },
          { id: 'stretch', name: 'Dehnung', muscle: 'Brust', type: 'time', sets: 1, target_reps: null, target_seconds: 45, default_weight_kg: null, cue: '', video_query: '', phase: 'cooldown' },
        ],
      },
    ],
  };
}

async function login(app, email = 'tuncay@example.com', password = 'password1') {
  const res = await request(app).post('/api/login').send({ email, password });
  return res.headers['set-cookie'][0];
}

describe('RPE und Notizen', () => {
  let app;
  let db;
  let cookie;
  let sessionId;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    cookie = await login(app);
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
    const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    sessionId = res.body.session_id;
    await request(app)
      .post(`/api/sessions/${sessionId}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'bench', set_number: 1, reps: 10, weight_kg: 40, duration_s: null });
  });

  describe('POST /api/sessions/:id/rpe', () => {
    it('legt an und aktualisiert idempotent', async () => {
      const first = await request(app)
        .post(`/api/sessions/${sessionId}/rpe`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'bench', rpe: 8 });
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ ok: true, rpe: 8 });

      await request(app)
        .post(`/api/sessions/${sessionId}/rpe`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'bench', rpe: 9 });

      const rows = db.prepare('SELECT exercise_id, rpe FROM exercise_rpe WHERE session_id = ?').all(sessionId);
      expect(rows).toEqual([{ exercise_id: 'bench', rpe: 9 }]);
    });

    it('rpe null entfernt den Eintrag', async () => {
      await request(app).post(`/api/sessions/${sessionId}/rpe`).set('Cookie', cookie).send({ exercise_id: 'bench', rpe: 8 });
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/rpe`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'bench', rpe: null });
      expect(res.body).toEqual({ ok: true, rpe: null });
      expect(db.prepare('SELECT COUNT(*) c FROM exercise_rpe').get().c).toBe(0);
    });

    it('lehnt Werte außerhalb 1–10 ab', async () => {
      for (const rpe of [0, 11, 2.5]) {
        const res = await request(app)
          .post(`/api/sessions/${sessionId}/rpe`)
          .set('Cookie', cookie)
          .send({ exercise_id: 'bench', rpe });
        expect(res.status).toBe(422);
      }
    });

    it('überlebt ein erneutes Satz-Upsert', async () => {
      await request(app).post(`/api/sessions/${sessionId}/rpe`).set('Cookie', cookie).send({ exercise_id: 'bench', rpe: 8 });
      await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'bench', set_number: 1, reps: 12, weight_kg: 40, duration_s: null });
      expect(db.prepare('SELECT rpe FROM exercise_rpe WHERE session_id = ?').get(sessionId).rpe).toBe(8);
    });

    it('beendete Session -> 409, fremde Session -> 404', async () => {
      await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie).send({});
      const finished = await request(app)
        .post(`/api/sessions/${sessionId}/rpe`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'bench', rpe: 8 });
      expect(finished.status).toBe(409);

      const otherCookie = await login(app, 'partnerin@example.com', 'password2');
      const foreign = await request(app)
        .post(`/api/sessions/${sessionId}/rpe`)
        .set('Cookie', otherCookie)
        .send({ exercise_id: 'bench', rpe: 8 });
      expect(foreign.status).toBe(404);
    });
  });

  describe('Resume', () => {
    it('liefert gespeicherte RPE-Werte zurück', async () => {
      await request(app).post(`/api/sessions/${sessionId}/rpe`).set('Cookie', cookie).send({ exercise_id: 'bench', rpe: 7 });
      const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      expect(res.body.resumed).toBe(true);
      expect(res.body.rpe).toEqual([{ exercise_id: 'bench', rpe: 7 }]);
      expect(res.body.note).toBeNull();
    });
  });

  describe('Notiz beim Abschluss', () => {
    it('speichert die getrimmte Notiz', async () => {
      await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', cookie)
        .send({ note: '  Schulter hat gezogen  ' });
      expect(db.prepare('SELECT note FROM sessions WHERE id = ?').get(sessionId).note).toBe('Schulter hat gezogen');
    });

    it('leere Notiz wird null', async () => {
      await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie).send({ note: '   ' });
      expect(db.prepare('SELECT note FROM sessions WHERE id = ?').get(sessionId).note).toBeNull();
    });

    it('funktioniert ohne Body', async () => {
      const res = await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(db.prepare('SELECT note FROM sessions WHERE id = ?').get(sessionId).note).toBeNull();
    });

    it('zu lange Notiz -> 422', async () => {
      const res = await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', cookie)
        .send({ note: 'x'.repeat(1001) });
      expect(res.status).toBe(422);
    });
  });

  describe('buildAggregate', () => {
    it('nimmt RPE, Notiz und Cooldown-Markierung mit in den Prompt', async () => {
      await request(app).post(`/api/sessions/${sessionId}/rpe`).set('Cookie', cookie).send({ exercise_id: 'bench', rpe: 9 });
      await request(app)
        .post(`/api/sessions/${sessionId}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'stretch', set_number: 1, reps: null, weight_kg: null, duration_s: 45 });
      await request(app)
        .post(`/api/sessions/${sessionId}/finish`)
        .set('Cookie', cookie)
        .send({ note: 'Wenig geschlafen' });

      const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
      const aggregate = buildAggregate(db, session, plan());

      expect(aggregate.current_session.note).toBe('Wenig geschlafen');
      const bench = aggregate.current_session.exercises.find((e) => e.id === 'bench');
      expect(bench.rpe).toBe(9);
      expect(bench.sets[0]).toMatchObject({ set: 1, reps: 10, weight_kg: 40 });

      const stretch = aggregate.current_session.exercises.find((e) => e.id === 'stretch');
      expect(stretch.phase).toBe('cooldown');
      expect(stretch.sets[0].duration_display).toBe('45 Sek');
    });
  });
});

describe('POST /api/sessions/:id/note', () => {
  let app;
  let db;
  let cookie;
  let sessionId;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    cookie = await login(app);
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
    const res = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    sessionId = res.body.session_id;
  });

  it('speichert die Notiz während der Session', async () => {
    const res = await request(app)
      .post(`/api/sessions/${sessionId}/note`)
      .set('Cookie', cookie)
      .send({ note: '  Rücken zwickt  ' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, note: 'Rücken zwickt' });
    expect(db.prepare('SELECT note FROM sessions WHERE id = ?').get(sessionId).note).toBe('Rücken zwickt');
  });

  it('liefert die Notiz beim Resume und in /sessions/recent zurück', async () => {
    await request(app).post(`/api/sessions/${sessionId}/note`).set('Cookie', cookie).send({ note: 'Testnotiz' });

    const resumed = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    expect(resumed.body.note).toBe('Testnotiz');

    const recent = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
    expect(recent.body.active.note).toBe('Testnotiz');
  });

  it('leert die Notiz mit null', async () => {
    await request(app).post(`/api/sessions/${sessionId}/note`).set('Cookie', cookie).send({ note: 'weg damit' });
    await request(app).post(`/api/sessions/${sessionId}/note`).set('Cookie', cookie).send({ note: null });
    expect(db.prepare('SELECT note FROM sessions WHERE id = ?').get(sessionId).note).toBeNull();
  });

  it('beendete Session -> 409, fremde Session -> 404, zu lang -> 422', async () => {
    const foreignCookie = await login(app, 'partnerin@example.com', 'password2');
    expect(
      (await request(app).post(`/api/sessions/${sessionId}/note`).set('Cookie', foreignCookie).send({ note: 'x' })).status
    ).toBe(404);
    expect(
      (await request(app).post(`/api/sessions/${sessionId}/note`).set('Cookie', cookie).send({ note: 'x'.repeat(1001) })).status
    ).toBe(422);

    await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie).send({});
    expect(
      (await request(app).post(`/api/sessions/${sessionId}/note`).set('Cookie', cookie).send({ note: 'x' })).status
    ).toBe(409);
  });
});
