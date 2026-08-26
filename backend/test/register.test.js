import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

const VALID = {
  name: 'neuling',
  email: 'Neuling@Example.com',
  password: 'geheim1234',
  invite_code: 'LILIEF-2026',
};

describe('registrierung', () => {
  let app;
  let db;
  let previousCode;

  beforeEach(() => {
    ({ app, db } = setupTestApp());
    previousCode = process.env.REGISTER_INVITE_CODE;
    process.env.REGISTER_INVITE_CODE = 'LILIEF-2026';
  });

  afterEach(() => {
    if (previousCode === undefined) delete process.env.REGISTER_INVITE_CODE;
    else process.env.REGISTER_INVITE_CODE = previousCode;
  });

  it('gültige Daten -> 201, eingeloggt, onboarded:false', async () => {
    const res = await request(app).post('/api/register').send(VALID);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      name: 'neuling',
      email: 'neuling@example.com',
      onboarded: false,
      theme: { mode: null, palette: null },
      progress_layout: null,
    });
    expect(res.headers['set-cookie'][0]).toMatch(/^session=/);

    const me = await request(app).get('/api/me').set('Cookie', res.headers['set-cookie'][0]);
    expect(me.status).toBe(200);
    expect(me.body.name).toBe('neuling');
  });

  it('E-Mail wird kleingeschrieben gespeichert und Login damit möglich', async () => {
    await request(app).post('/api/register').send(VALID);

    const login = await request(app)
      .post('/api/login')
      .send({ email: 'NEULING@example.COM', password: 'geheim1234' });
    expect(login.status).toBe(200);
  });

  it('falscher Invite-Code -> 403, kein Nutzer angelegt', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ ...VALID, invite_code: 'falsch' });

    expect(res.status).toBe(403);
    expect(db.prepare('SELECT COUNT(*) AS c FROM users').get().c).toBe(3);
  });

  it('ohne REGISTER_INVITE_CODE im Env -> 403 (fail closed)', async () => {
    delete process.env.REGISTER_INVITE_CODE;
    const res = await request(app).post('/api/register').send(VALID);
    expect(res.status).toBe(403);
  });

  it('vergebene E-Mail -> 409 email taken', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ ...VALID, email: 'tuncay@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email taken');
  });

  it('vergebener Name -> 409 name taken', async () => {
    const res = await request(app).post('/api/register').send({ ...VALID, name: 'tuncay' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('name taken');
  });

  it('zu kurzes Passwort -> 422', async () => {
    const res = await request(app).post('/api/register').send({ ...VALID, password: 'kurz' });
    expect(res.status).toBe(422);
  });

  it('ungültige E-Mail -> 422', async () => {
    const res = await request(app).post('/api/register').send({ ...VALID, email: 'keine-mail' });
    expect(res.status).toBe(422);
  });

  it('neuer Nutzer sieht niemanden im Partner-Tab', async () => {
    const res = await request(app).post('/api/register').send(VALID);
    const cookie = res.headers['set-cookie'][0];

    const users = await request(app).get('/api/users').set('Cookie', cookie);
    expect(users.body).toEqual([]);
  });
});

describe('onboarding', () => {
  let app;
  let cookie;
  let previousCode;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    previousCode = process.env.REGISTER_INVITE_CODE;
    process.env.REGISTER_INVITE_CODE = 'LILIEF-2026';
    const res = await request(app).post('/api/register').send(VALID);
    cookie = res.headers['set-cookie'][0];
  });

  afterEach(() => {
    if (previousCode === undefined) delete process.env.REGISTER_INVITE_CODE;
    else process.env.REGISTER_INVITE_CODE = previousCode;
  });

  it('POST /api/me/onboarded setzt das Flag', async () => {
    const res = await request(app).post('/api/me/onboarded').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.onboarded).toBe(true);

    const me = await request(app).get('/api/me').set('Cookie', cookie);
    expect(me.body.onboarded).toBe(true);
  });

  it('zweiter Aufruf ist idempotent', async () => {
    const first = await request(app).post('/api/me/onboarded').set('Cookie', cookie);
    const second = await request(app).post('/api/me/onboarded').set('Cookie', cookie);
    expect(second.status).toBe(200);
    expect(second.body.onboarded).toBe(true);
    expect(first.body).toEqual(second.body);
  });

  it('Bestandsnutzer sind schon onboarded', async () => {
    const login = await request(app)
      .post('/api/login')
      .send({ email: 'tuncay@example.com', password: 'password1' });
    expect(login.body.onboarded).toBe(true);
  });

  it('ohne Cookie -> 401', async () => {
    const res = await request(app).post('/api/me/onboarded');
    expect(res.status).toBe(401);
  });
});
