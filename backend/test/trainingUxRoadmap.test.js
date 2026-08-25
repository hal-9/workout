import { describe, it, expect, beforeEach } from 'vitest';
import { workingSets, isWarmupSet } from 'shared/setTypes';
import { calculatePlates } from 'shared/plateCalc';
import { warmupSets } from 'shared/warmupCalc';
import { proposalRationale, progressionConfig } from 'shared/progression';
import request from 'supertest';
import { setupTestApp } from './helpers.js';

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
          { id: 'pu', name: 'Liegestütze', muscle: 'Brust', type: 'bw', sets: 3, target_reps: '8-12', target_seconds: null, default_weight_kg: null, cue: '', video_query: '' },
        ],
      },
    ],
  };
}

describe('setTypes', () => {
  it('filters warm-up sets from working sets', () => {
    const sets = [
      { set_type: 'warmup', reps: 10 },
      { set_type: 'working', reps: 8 },
    ];
    expect(workingSets(sets).length).toBe(1);
    expect(isWarmupSet({ set_type: 'warmup' })).toBe(true);
  });
});

describe('plateCalc', () => {
  it('calculates plates per side', () => {
    const result = calculatePlates(60, 20, [20, 10, 5, 2.5]);
    expect(result.total).toBe(60);
    expect(result.perSide).toEqual([20]);
  });
});

describe('warmupCalc', () => {
  it('returns progressive warm-up sets below working weight', () => {
    const sets = warmupSets(100);
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every((s) => s.weight_kg < 100)).toBe(true);
  });
});

describe('proposalRationale', () => {
  it('explains weight progression in German', () => {
    const ex = {
      id: 'bench',
      type: 'wt',
      sets: 3,
      target_reps: '8-12',
      default_weight_kg: 40,
    };
    const config = progressionConfig(ex);
    const proposal = {
      field: 'default_weight_kg',
      sessions_in_streak: 2,
      from: 40,
      to: 42.5,
    };
    const text = proposalRationale(ex, config, proposal);
    expect(text).toContain('2× am Ziel');
    expect(text).toContain('2.5 kg');
  });
});

describe('export API', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    const loginRes = await request(app)
      .post('/api/login')
      .send({ email: 'tuncay@example.com', password: 'password1' });
    cookie = loginRes.headers['set-cookie'][0];
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
  });

  it('returns JSON export for authenticated user', async () => {
    const res = await request(app).get('/api/export').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.exported_at).toBeTruthy();
    expect(res.body.plan).toBeTruthy();
  });

  it('returns CSV export', async () => {
    const res = await request(app).get('/api/export.csv').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain('finished_at');
  });
});

describe('set_type persistence', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    const loginRes = await request(app)
      .post('/api/login')
      .send({ email: 'tuncay@example.com', password: 'password1' });
    cookie = loginRes.headers['set-cookie'][0];
    await request(app).post('/api/plan').set('Cookie', cookie).send(plan());
  });

  it('stores set_type on log', async () => {
    const session = await request(app)
      .post('/api/sessions')
      .set('Cookie', cookie)
      .send({ day_key: 'push' });
    const sid = session.body.session_id;

    await request(app)
      .post(`/api/sessions/${sid}/sets`)
      .set('Cookie', cookie)
      .send({
        exercise_id: 'pu',
        set_number: 1,
        reps: 10,
        weight_kg: null,
        duration_s: null,
        set_type: 'warmup',
      });

    const recent = await request(app).get('/api/sessions/recent').set('Cookie', cookie);
    const log = recent.body.active.set_logs.find((l) => l.set_number === 1);
    expect(log.set_type).toBe('warmup');
  });
});
