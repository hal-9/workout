import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';
import { hashToken } from '../src/auth.js';

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
        .send({ email: 'tuncay@example.com', password: 'password1' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: expect.any(Number),
        name: 'tuncay',
        email: 'tuncay@example.com',
        onboarded: true,
        theme: { mode: null, palette: null },
        progress_layout: null,
      });
      expect(res.headers['set-cookie'][0]).toMatch(/^session=/);
    });

    it('returns 401 on wrong password', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('returns 401 on unknown user', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ email: 'nobody@example.com', password: 'password1' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/me', () => {
    it('returns user data with valid cookie', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'password1' });
      const cookie = login.headers['set-cookie'][0];

      const res = await request(app).get('/api/me').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: expect.any(Number),
        name: 'tuncay',
        email: 'tuncay@example.com',
        onboarded: true,
        theme: { mode: null, palette: null },
        progress_layout: null,
      });
    });

    it('returns 401 without cookie', async () => {
      const res = await request(app).get('/api/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with expired token', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'password1' });
      const cookie = login.headers['set-cookie'][0];
      const token = cookie.match(/session=([^;]+)/)[1];

      db.prepare(
        "UPDATE auth_sessions SET expires_at = datetime('now', '-1 day') WHERE token = ?"
      ).run(hashToken(token));

      const res = await request(app).get('/api/me').set('Cookie', cookie);
      expect(res.status).toBe(401);
    });
  });

  describe('rolling session', () => {
    it('extends expires_at on valid request', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'password1' });
      const cookie = login.headers['set-cookie'][0];
      const token = cookie.match(/session=([^;]+)/)[1];

      const before = db
        .prepare('SELECT expires_at FROM auth_sessions WHERE token = ?')
        .get(hashToken(token)).expires_at;

      db.prepare(
        "UPDATE auth_sessions SET expires_at = datetime('now', '+1 day') WHERE token = ?"
      ).run(hashToken(token));

      await request(app).get('/api/me').set('Cookie', cookie);

      const after = db
        .prepare('SELECT expires_at FROM auth_sessions WHERE token = ?')
        .get(hashToken(token)).expires_at;

      expect(new Date(after).getTime()).toBeGreaterThan(new Date(before).getTime());
    });
  });

  describe('session-härtung', () => {
    it('speichert nur den Token-Hash in der DB, nie das rohe Token', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'password1' });
      const token = login.headers['set-cookie'][0].match(/session=([^;]+)/)[1];

      const rawHit = db
        .prepare('SELECT 1 FROM auth_sessions WHERE token = ?')
        .get(token);
      const hashHit = db
        .prepare('SELECT 1 FROM auth_sessions WHERE token = ?')
        .get(hashToken(token));

      expect(rawHit).toBeUndefined();
      expect(hashHit).toBeDefined();
    });

    it('räumt abgelaufene Sessions beim Login auf', async () => {
      db.prepare(
        `INSERT INTO auth_sessions (token, user_id, expires_at)
         VALUES ('stale', (SELECT id FROM users WHERE name = 'tuncay'), datetime('now', '-1 day'))`
      ).run();

      await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'password1' });

      const stale = db.prepare("SELECT 1 FROM auth_sessions WHERE token = 'stale'").get();
      expect(stale).toBeUndefined();
    });

    it('rate-limitet fehlgeschlagene Logins (11. Versuch -> 429)', async () => {
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/api/login')
          .send({ email: 'tuncay@example.com', password: 'falsch' });
        expect(res.status).toBe(401);
      }

      const blocked = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'falsch' });
      expect(blocked.status).toBe(429);

      // Auch mit korrektem Passwort gesperrt: sonst bleibt Brute-Force nutzbar.
      const legit = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'password1' });
      expect(legit.status).toBe(429);
    });

    it('erfolgreiche Logins zählen nicht gegen das Limit', async () => {
      for (let i = 0; i < 12; i++) {
        const res = await request(app)
          .post('/api/login')
          .send({ email: 'tuncay@example.com', password: 'password1' });
        expect(res.status).toBe(200);
      }
    });

    it('unbekannter Nutzer und falsches Passwort antworten gleich', async () => {
      const unknown = await request(app)
        .post('/api/login')
        .send({ email: 'nobody@example.com', password: 'password1' });
      const wrongPw = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'falsch' });

      expect(unknown.status).toBe(401);
      expect(unknown.body).toEqual(wrongPw.body);
    });

    it('nicht-string Passwort im Body crasht nicht (401)', async () => {
      const res = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: { evil: true } });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/logout', () => {
    it('returns 204 and invalidates token', async () => {
      const login = await request(app)
        .post('/api/login')
        .send({ email: 'tuncay@example.com', password: 'password1' });
      const cookie = login.headers['set-cookie'][0];

      const logoutRes = await request(app).post('/api/logout').set('Cookie', cookie);
      expect(logoutRes.status).toBe(204);

      const meRes = await request(app).get('/api/me').set('Cookie', cookie);
      expect(meRes.status).toBe(401);
    });
  });
});
