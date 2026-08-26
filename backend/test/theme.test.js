import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

describe('PUT /api/me/theme', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    const login = await request(app)
      .post('/api/login')
      .send({ email: 'tuncay@example.com', password: 'password1' });
    cookie = login.headers['set-cookie'][0];
  });

  it('speichert Modus und Palette und gibt sie in /me zurück', async () => {
    const res = await request(app)
      .put('/api/me/theme')
      .set('Cookie', cookie)
      .send({ mode: 'dark', palette: 'ocean' });

    expect(res.status).toBe(200);
    expect(res.body.theme).toEqual({ mode: 'dark', palette: 'ocean' });

    const me = await request(app).get('/api/me').set('Cookie', cookie);
    expect(me.body.theme).toEqual({ mode: 'dark', palette: 'ocean' });
  });

  it('lehnt unbekannte Palette ab', async () => {
    const res = await request(app)
      .put('/api/me/theme')
      .set('Cookie', cookie)
      .send({ mode: 'dark', palette: 'neon' });
    expect(res.status).toBe(422);
  });

  it('lehnt unbekannten Modus ab', async () => {
    const res = await request(app)
      .put('/api/me/theme')
      .set('Cookie', cookie)
      .send({ mode: 'sepia', palette: 'violet' });
    expect(res.status).toBe(422);
  });

  it('braucht eine Session', async () => {
    const res = await request(app).put('/api/me/theme').send({ mode: 'dark', palette: 'violet' });
    expect(res.status).toBe(401);
  });
});
