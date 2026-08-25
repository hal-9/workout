import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

async function login(app, email, password) {
  const res = await request(app).post('/api/login').send({ email, password });
  return res.headers['set-cookie'][0];
}

describe('freunde', () => {
  let app;
  let db;
  let tuncay;
  let fremde;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    tuncay = await login(app, 'tuncay@example.com', 'password1');
    fremde = await login(app, 'fremde@example.com', 'password3');
  });

  describe('GET /api/friends', () => {
    it('liefert Freunde, eingehende und ausgehende Anfragen', async () => {
      const res = await request(app).get('/api/friends').set('Cookie', tuncay);

      expect(res.status).toBe(200);
      expect(res.body.friends.map((f) => f.name)).toEqual(['partnerin']);
      expect(res.body.incoming).toEqual([]);
      expect(res.body.outgoing).toEqual([]);
    });

    it('zeigt die Anfrage auf beiden Seiten', async () => {
      await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const mine = await request(app).get('/api/friends').set('Cookie', fremde);
      expect(mine.body.outgoing.map((r) => r.name)).toEqual(['tuncay']);
      expect(mine.body.incoming).toEqual([]);

      const theirs = await request(app).get('/api/friends').set('Cookie', tuncay);
      expect(theirs.body.incoming.map((r) => r.name)).toEqual(['fremde']);
      expect(theirs.body.friends.map((f) => f.name)).toEqual(['partnerin']);
    });
  });

  describe('POST /api/friends/requests', () => {
    it('legt eine pending-Anfrage an -> 201', async () => {
      const res = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'pending', name: 'tuncay' });
    });

    it('E-Mail ist case-insensitive', async () => {
      const res = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'TUNCAY@Example.com' });

      expect(res.status).toBe(201);
    });

    it('unbekannte E-Mail -> 404', async () => {
      const res = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'niemand@example.com' });

      expect(res.status).toBe(404);
    });

    it('eigene E-Mail -> 422', async () => {
      const res = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'fremde@example.com' });

      expect(res.status).toBe(422);
    });

    it('doppelte Anfrage -> 409 pending', async () => {
      await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const res = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('pending');
    });

    it('bestehende Freundschaft -> 409 accepted', async () => {
      const res = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', tuncay)
        .send({ email: 'partnerin@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('accepted');
    });

    it('Gegenanfrage nimmt die offene Anfrage direkt an', async () => {
      await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const res = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', tuncay)
        .send({ email: 'fremde@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('accepted');

      const friends = await request(app).get('/api/friends').set('Cookie', tuncay);
      expect(friends.body.friends.map((f) => f.name).sort()).toEqual(['fremde', 'partnerin']);
    });
  });

  describe('POST /api/friends/requests/:id/accept', () => {
    it('Empfänger nimmt an -> beide sind Freunde', async () => {
      const created = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const res = await request(app)
        .post(`/api/friends/requests/${created.body.id}/accept`)
        .set('Cookie', tuncay);
      expect(res.status).toBe(200);

      const mine = await request(app).get('/api/friends').set('Cookie', tuncay);
      expect(mine.body.friends.map((f) => f.name).sort()).toEqual(['fremde', 'partnerin']);
      const theirs = await request(app).get('/api/friends').set('Cookie', fremde);
      expect(theirs.body.friends.map((f) => f.name)).toEqual(['tuncay']);
    });

    it('Absender kann die eigene Anfrage nicht annehmen -> 404', async () => {
      const created = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const res = await request(app)
        .post(`/api/friends/requests/${created.body.id}/accept`)
        .set('Cookie', fremde);
      expect(res.status).toBe(404);
    });

    it('Unbeteiligter kann nicht annehmen -> 404', async () => {
      const created = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const partnerin = await login(app, 'partnerin@example.com', 'password2');
      const res = await request(app)
        .post(`/api/friends/requests/${created.body.id}/accept`)
        .set('Cookie', partnerin);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/friends/requests/:id', () => {
    it('Empfänger lehnt ab -> Zeile weg, erneute Anfrage möglich', async () => {
      const created = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const res = await request(app)
        .delete(`/api/friends/requests/${created.body.id}`)
        .set('Cookie', tuncay);
      expect(res.status).toBe(204);
      expect(db.prepare('SELECT COUNT(*) AS c FROM friendships').get().c).toBe(1);

      const again = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });
      expect(again.status).toBe(201);
    });

    it('Absender zieht die Anfrage zurück -> 204', async () => {
      const created = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const res = await request(app)
        .delete(`/api/friends/requests/${created.body.id}`)
        .set('Cookie', fremde);
      expect(res.status).toBe(204);
    });

    it('Unbeteiligter -> 404', async () => {
      const created = await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const partnerin = await login(app, 'partnerin@example.com', 'password2');
      const res = await request(app)
        .delete(`/api/friends/requests/${created.body.id}`)
        .set('Cookie', partnerin);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/friends/:userId', () => {
    it('entfernt die Freundschaft in beide Richtungen', async () => {
      const partnerinId = db.prepare("SELECT id FROM users WHERE name = 'partnerin'").get().id;

      const res = await request(app).delete(`/api/friends/${partnerinId}`).set('Cookie', tuncay);
      expect(res.status).toBe(204);

      const mine = await request(app).get('/api/friends').set('Cookie', tuncay);
      expect(mine.body.friends).toEqual([]);
      const partnerin = await login(app, 'partnerin@example.com', 'password2');
      const theirs = await request(app).get('/api/friends').set('Cookie', partnerin);
      expect(theirs.body.friends).toEqual([]);
    });

    it('Nicht-Freund -> 404', async () => {
      const tuncayId = db.prepare("SELECT id FROM users WHERE name = 'tuncay'").get().id;
      const res = await request(app).delete(`/api/friends/${tuncayId}`).set('Cookie', fremde);
      expect(res.status).toBe(404);
    });

    it('pending-Anfrage ist keine Freundschaft -> 404', async () => {
      await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const tuncayId = db.prepare("SELECT id FROM users WHERE name = 'tuncay'").get().id;
      const res = await request(app).delete(`/api/friends/${tuncayId}`).set('Cookie', fremde);
      expect(res.status).toBe(404);
    });
  });

  describe('Zugriff auf Partner-Fortschritt', () => {
    it('nach dem Entfernen ist der Fortschritt gesperrt', async () => {
      const partnerinId = db.prepare("SELECT id FROM users WHERE name = 'partnerin'").get().id;
      await request(app).delete(`/api/friends/${partnerinId}`).set('Cookie', tuncay);

      const res = await request(app)
        .get(`/api/partner/progress?user_id=${partnerinId}`)
        .set('Cookie', tuncay);
      expect(res.status).toBe(403);
    });

    it('pending reicht nicht -> 403', async () => {
      await request(app)
        .post('/api/friends/requests')
        .set('Cookie', fremde)
        .send({ email: 'tuncay@example.com' });

      const tuncayId = db.prepare("SELECT id FROM users WHERE name = 'tuncay'").get().id;
      const res = await request(app)
        .get(`/api/partner/progress?user_id=${tuncayId}`)
        .set('Cookie', fremde);
      expect(res.status).toBe(403);
    });
  });

  it('ohne Cookie -> 401', async () => {
    const res = await request(app).get('/api/friends');
    expect(res.status).toBe(401);
  });
});
