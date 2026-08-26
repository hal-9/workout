import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';
import { runScheduledPushes, berlinNow } from '../src/scheduler.js';

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

const { sendNotificationMock } = vi.hoisted(() => ({ sendNotificationMock: vi.fn() }));
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: sendNotificationMock,
  },
}));

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
          {
            id: 'pu',
            name: 'Liegestütze',
            muscle: 'Brust',
            type: 'bw',
            sets: 1,
            target_reps: '8-12',
            target_seconds: null,
            default_weight_kg: null,
            cue: 'cue',
            video_query: 'q',
          },
        ],
      },
    ],
  };
}

async function login(app, name, password) {
  const res = await request(app).post('/api/login').send({ name, password });
  return res.headers['set-cookie'][0];
}

function subscription(endpoint) {
  return { endpoint, keys: { p256dh: 'p256dh-key', auth: 'auth-key' } };
}

describe('Web Push', () => {
  let app;
  let db;
  let cookie; // tuncay
  let partnerCookie; // partnerin (mit tuncay befreundet)

  beforeEach(async () => {
    process.env.VAPID_PUBLIC_KEY = 'test-public';
    process.env.VAPID_PRIVATE_KEY = 'test-private';
    sendNotificationMock.mockReset().mockResolvedValue({});
    ({ app, db } = setupTestApp());
    cookie = await login(app, 'tuncay@example.com', 'password1');
    partnerCookie = await login(app, 'partnerin@example.com', 'password2');
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
  });

  it('public-key liefert den VAPID-Key, Subscribe validiert', async () => {
    const key = await request(app).get('/api/push/public-key').set('Cookie', cookie);
    expect(key.status).toBe(200);
    expect(key.body.public_key).toBe('test-public');

    const bad = await request(app)
      .post('/api/push/subscribe')
      .set('Cookie', cookie)
      .send({ subscription: { endpoint: 'nicht-url' }, categories: ['timer'] });
    expect(bad.status).toBe(422);

    const ok = await request(app)
      .post('/api/push/subscribe')
      .set('Cookie', cookie)
      .send({ subscription: subscription('https://push.example/one'), categories: ['timer', 'friends'] });
    expect(ok.status).toBe(200);

    // Upsert: gleiche endpoint-URL überschreibt Kategorien statt zu duplizieren
    await request(app)
      .post('/api/push/subscribe')
      .set('Cookie', cookie)
      .send({ subscription: subscription('https://push.example/one'), categories: ['weekly'] });
    const rows = db.prepare('SELECT categories_json FROM push_subscriptions').all();
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].categories_json)).toEqual(['weekly']);
  });

  it('Finish benachrichtigt Freunde mit friends-Kategorie', async () => {
    // Partnerin abonniert friends-Pushes
    await request(app)
      .post('/api/push/subscribe')
      .set('Cookie', partnerCookie)
      .send({ subscription: subscription('https://push.example/partner'), categories: ['friends'] });

    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
    const session = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    await request(app)
      .post(`/api/sessions/${session.body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
    await request(app).post(`/api/sessions/${session.body.session_id}/finish`).set('Cookie', cookie).send({});

    await vi.waitFor(() => expect(sendNotificationMock).toHaveBeenCalledTimes(1));
    const [sub, payload] = sendNotificationMock.mock.calls[0];
    expect(sub.endpoint).toBe('https://push.example/partner');
    expect(JSON.parse(payload).title).toContain('hat trainiert');
  });

  it('räumt abgelaufene Subscriptions beim Senden auf (410)', async () => {
    await request(app)
      .post('/api/push/subscribe')
      .set('Cookie', partnerCookie)
      .send({ subscription: subscription('https://push.example/gone'), categories: ['friends'] });
    sendNotificationMock.mockRejectedValueOnce({ statusCode: 410 });

    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
    const session = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    await request(app)
      .post(`/api/sessions/${session.body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
    await request(app).post(`/api/sessions/${session.body.session_id}/finish`).set('Cookie', cookie).send({});

    await vi.waitFor(() => {
      expect(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').get().n).toBe(0);
    });
  });

  it('Timer-Route validiert Sekunden', async () => {
    const bad = await request(app).post('/api/push/timer').set('Cookie', cookie).send({ seconds: 2 });
    expect(bad.status).toBe(422);
    const ok = await request(app).post('/api/push/timer').set('Cookie', cookie).send({ seconds: 60 });
    expect(ok.status).toBe(200);
    const cancel = await request(app).delete('/api/push/timer').set('Cookie', cookie);
    expect(cancel.status).toBe(200);
  });

  it('Sonntag-Recap feuert genau einmal pro Woche (push_log)', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
    const session = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
    await request(app)
      .post(`/api/sessions/${session.body.session_id}/sets`)
      .set('Cookie', cookie)
      .send({ exercise_id: 'pu', set_number: 1, reps: 10, weight_kg: null, duration_s: null });
    await request(app).post(`/api/sessions/${session.body.session_id}/finish`).set('Cookie', cookie).send({});
    await request(app)
      .post('/api/push/subscribe')
      .set('Cookie', cookie)
      .send({ subscription: subscription('https://push.example/me'), categories: ['weekly'] });
    sendNotificationMock.mockClear();

    // 2026-08-23 ist ein Sonntag; 17:00 UTC = 19:00 Berlin
    const sunday = new Date('2026-08-23T17:00:00Z');
    expect(berlinNow(sunday)).toMatchObject({ weekday: 'Sun', hour: 19 });

    await runScheduledPushes(db, sunday);
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sendNotificationMock.mock.calls[0][1]).title).toBe('Dein Wochen-Recap');

    await runScheduledPushes(db, sunday);
    expect(sendNotificationMock).toHaveBeenCalledTimes(1); // kein Doppel-Versand
  });
});
