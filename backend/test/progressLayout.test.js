import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

describe('PUT /api/me/progress-layout', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    const login = await request(app)
      .post('/api/login')
      .send({ email: 'tuncay@example.com', password: 'password1' });
    cookie = login.headers['set-cookie'][0];
  });

  it('speichert Reihenfolge und versteckte Karten und gibt sie in /me zurück', async () => {
    const layout = { order: ['stats', 'tree', 'exercises'], hidden: ['recovery'] };
    const res = await request(app)
      .put('/api/me/progress-layout')
      .set('Cookie', cookie)
      .send(layout);

    expect(res.status).toBe(200);
    expect(res.body.progress_layout).toEqual(layout);

    const me = await request(app).get('/api/me').set('Cookie', cookie);
    expect(me.body.progress_layout).toEqual(layout);
  });

  it('lehnt fehlende Felder ab', async () => {
    const res = await request(app)
      .put('/api/me/progress-layout')
      .set('Cookie', cookie)
      .send({ order: ['tree'] });

    expect(res.status).toBe(422);
  });

  it('braucht Login', async () => {
    const res = await request(app)
      .put('/api/me/progress-layout')
      .send({ order: [], hidden: [] });

    expect(res.status).toBe(401);
  });
});
