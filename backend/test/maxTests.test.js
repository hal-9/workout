import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

async function login(app, email = 'tuncay@example.com', password = 'password1') {
  const res = await request(app).post('/api/login').send({ email, password });
  return res.headers['set-cookie'][0];
}

describe('max-tests', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    cookie = await login(app);
  });

  describe('POST /api/max-tests', () => {
    it('gültig -> 201', async () => {
      const res = await request(app)
        .post('/api/max-tests')
        .set('Cookie', cookie)
        .send({ kind: 'pushups', value: 25, date: '2026-07-04' });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: expect.any(Number) });
    });

    it('ungültiger kind -> 422', async () => {
      const res = await request(app)
        .post('/api/max-tests')
        .set('Cookie', cookie)
        .send({ kind: 'bogus', value: 25 });
      expect(res.status).toBe(422);
    });

    it('Default-Datum heute', async () => {
      const res = await request(app)
        .post('/api/max-tests')
        .set('Cookie', cookie)
        .send({ kind: 'pushups', value: 25 });
      expect(res.status).toBe(201);

      const listRes = await request(app).get('/api/max-tests?kind=pushups').set('Cookie', cookie);
      const today = new Date().toISOString().slice(0, 10);
      expect(listRes.body[0].date).toBe(today);
    });
  });

  describe('GET /api/max-tests', () => {
    it('gefiltert + sortiert', async () => {
      await request(app).post('/api/max-tests').set('Cookie', cookie).send({ kind: 'pushups', value: 20, date: '2026-07-02' });
      await request(app).post('/api/max-tests').set('Cookie', cookie).send({ kind: 'pushups', value: 25, date: '2026-07-01' });
      await request(app).post('/api/max-tests').set('Cookie', cookie).send({ kind: 'bodyweight', value: 80, date: '2026-07-01' });

      const res = await request(app).get('/api/max-tests?kind=pushups').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body.map((r) => r.date)).toEqual(['2026-07-01', '2026-07-02']);
    });

    it('Nutzer sieht nur eigene Einträge', async () => {
      await request(app).post('/api/max-tests').set('Cookie', cookie).send({ kind: 'pushups', value: 20 });
      const partnerCookie = await login(app, 'partnerin@example.com', 'password2');
      const res = await request(app).get('/api/max-tests').set('Cookie', partnerCookie);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/users', () => {
    it('liefert nur befreundete Nutzer', async () => {
      const res = await request(app).get('/api/users').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.map((u) => u.name)).toEqual(['partnerin']);
    });
  });

  describe('GET /api/partner/progress', () => {
    it('liefert session-basierten Fortschritt + Name des ausgewählten anderen Nutzers', async () => {
      await request(app).post('/api/plan').set('Cookie', cookie).send({
        schema_version: 1,
        name: 'Partner Plan',
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
        ],
      });

      const sessionRes = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
      await request(app)
        .post(`/api/sessions/${sessionRes.body.session_id}/sets`)
        .set('Cookie', cookie)
        .send({ exercise_id: 'pu', set_number: 1, reps: 20, weight_kg: null, duration_s: null });
      await request(app).post(`/api/sessions/${sessionRes.body.session_id}/finish`).set('Cookie', cookie);

      const partnerCookie = await login(app, 'partnerin@example.com', 'password2');
      const others = await request(app).get('/api/users').set('Cookie', partnerCookie);
      const tuncayId = others.body.find((u) => u.name === 'tuncay').id;

      const res = await request(app)
        .get(`/api/partner/progress?user_id=${tuncayId}`)
        .set('Cookie', partnerCookie);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('tuncay');
      expect(res.body.plan_name).toBe('Partner Plan');
      expect(res.body.highlights).toHaveLength(1);
      expect(res.body.highlights[0]).toMatchObject({
        exercise_id: 'pu',
        latest_value: 20,
      });
    });

    it('ohne user_id -> 422', async () => {
      const res = await request(app).get('/api/partner/progress').set('Cookie', cookie);
      expect(res.status).toBe(422);
    });

    // 403 vor 404: ob eine user_id existiert, soll die Antwort nicht verraten.
    it('unbekannter user_id -> 403', async () => {
      const res = await request(app).get('/api/partner/progress?user_id=999').set('Cookie', cookie);
      expect(res.status).toBe(403);
    });

    it('nicht befreundeter Nutzer -> 403', async () => {
      const fremdeCookie = await login(app, 'fremde@example.com', 'password3');
      const tuncayId = db.prepare("SELECT id FROM users WHERE name = 'tuncay'").get().id;
      const res = await request(app)
        .get(`/api/partner/progress?user_id=${tuncayId}`)
        .set('Cookie', fremdeCookie);
      expect(res.status).toBe(403);
    });
  });
});
