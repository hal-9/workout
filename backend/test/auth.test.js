import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

describe('auth', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = setupTestApp());
  });

  describe('POST /api/login', () => {
    it('returns 200 and sets cookie on correct credentials', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ name: 'tuncay', password: 'password1' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: expect.any(Number), name: 'tuncay' });
      expect(res.headers['set-cookie'][0]).toMatch(/^session=/);
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ name: 'tuncay', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('returns 401 on unknown user', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ name: 'nobody', password: 'password1' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/me', () => {
    it('returns user data with valid cookie', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ name: 'tuncay', password: 'password1' });
      const cookie = login.headers['set-cookie'][0];

      const res = await request(app).get('/api/me').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: expect.any(Number), name: 'tuncay' });
    });

    it('returns 401 without cookie', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with expired token', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ name: 'tuncay', password: 'password1' });
      const cookie = login.headers['set-cookie'][0];
      const token = cookie.match(/session=([^;]+)/)[1];

      db.prepare(
        "UPDATE auth_sessions SET expires_at = datetime('now', '-1 day') WHERE token = ?"
      ).run(token);

      const res = await request(app).get('/api/me').set('Cookie', cookie);
      expect(res.status).toBe(401);
    });
  });

  describe('rolling session', () => {
    it('extends expires_at on valid request', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ name: 'tuncay', password: 'password1' });
      const cookie = login.headers['set-cookie'][0];
      const token = cookie.match(/session=([^;]+)/)[1];

      const before = db
        .prepare('SELECT expires_at FROM auth_sessions WHERE token = ?')
        .get(token).expires_at;

      db.prepare(
        "UPDATE auth_sessions SET expires_at = datetime('now', '+1 day') WHERE token = ?"
      ).run(token);

      await request(app).get('/api/me').set('Cookie', cookie);

      const after = db
        .prepare('SELECT expires_at FROM auth_sessions WHERE token = ?')
        .get(token).expires_at;

      expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
    });
  });

  describe('POST /api/logout', () => {
    it('returns 204 and invalidates token', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ name: 'tuncay', password: 'password1' });
      const cookie = login.headers['set-cookie'][0];

      const logoutRes = await request(app).post('/api/logout').set('Cookie', cookie);
      expect(logoutRes.status).toBe(204);

      const meRes = await request(app).get('/api/me').set('Cookie', cookie);
      expect(meRes.status).toBe(401);
    });
  });
});
