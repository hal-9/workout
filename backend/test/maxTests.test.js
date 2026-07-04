import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

async function login(app, name = 'tuncay', password = 'password1') {
  const res = await request(app).post('/api/login').send({ name, password });
  return res.headers['set-cookie'][0];
}

describe('max-tests', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    ({ app } = setupTestApp());
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
      const partnerCookie = await login(app, 'partnerin', 'password2');
      const res = await request(app).get('/api/max-tests').set('Cookie', partnerCookie);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('GET /api/users', () => {
    it('liefert alle anderen Nutzer, nicht sich selbst', async () => {
      const res = await request(app).get('/api/users').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.map((u) => u.name)).toEqual(['partnerin']);
    });
  });

  describe('GET /api/partner/progress', () => {
    it('liefert max_tests + Name des ausgewählten anderen Nutzers', async () => {
      await request(app).post('/api/max-tests').set('Cookie', cookie).send({ kind: 'pushups', value: 20, date: '2026-07-01' });
      const partnerCookie = await login(app, 'partnerin', 'password2');
      await request(app).post('/api/max-tests').set('Cookie', partnerCookie).send({ kind: 'bodyweight', value: 60 });

      const others = await request(app).get('/api/users').set('Cookie', partnerCookie);
      const tuncayId = others.body.find((u) => u.name === 'tuncay').id;

      const res = await request(app)
        .get(`/api/partner/progress?user_id=${tuncayId}`)
        .set('Cookie', partnerCookie);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('tuncay');
      expect(res.body.max_tests).toHaveLength(1);
      expect(res.body.max_tests[0]).toMatchObject({ kind: 'pushups', value: 20 });
    });

    it('ohne user_id -> 422', async () => {
      const res = await request(app).get('/api/partner/progress').set('Cookie', cookie);
      expect(res.status).toBe(422);
    });

    it('unbekannter user_id -> 404', async () => {
      const res = await request(app).get('/api/partner/progress?user_id=999').set('Cookie', cookie);
      expect(res.status).toBe(404);
    });
  });
});
