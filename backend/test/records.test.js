import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  bestsForExercise,
  detectNewRecords,
  estimateOneRepMax,
  sessionMetrics,
  sessionTonnage,
  setTonnage,
} from 'shared/records';
import { setupTestApp } from './helpers.js';

function ex(overrides = {}) {
  return {
    id: 'bench',
    name: 'Bankdrücken',
    muscle: 'Brust',
    type: 'wt',
    sets: 3,
    target_reps: '8-12',
    target_seconds: null,
    default_weight_kg: 40,
    cue: '',
    video_query: '',
    ...overrides,
  };
}

function session(setsByExerciseObj) {
  return { setsByExercise: new Map(Object.entries(setsByExerciseObj)) };
}

describe('estimateOneRepMax', () => {
  it('rechnet nach Epley', () => {
    expect(estimateOneRepMax(100, 10)).toBeCloseTo(133.3, 1);
    expect(estimateOneRepMax(60, 1)).toBeCloseTo(62, 1);
  });

  it('gibt null bei fehlenden Werten', () => {
    expect(estimateOneRepMax(null, 10)).toBeNull();
    expect(estimateOneRepMax(100, 0)).toBeNull();
  });
});

describe('Tonnage', () => {
  it('zählt nur Gewichtsübungen', () => {
    expect(setTonnage(ex(), { reps: 10, weight_kg: 40 })).toBe(400);
    expect(setTonnage(ex({ type: 'bw' }), { reps: 10 })).toBe(0);
    expect(setTonnage(ex({ type: 'cardio' }), { duration_s: 1500 })).toBe(0);
  });

  it('summiert über die Sätze', () => {
    expect(
      sessionTonnage(ex(), [
        { reps: 10, weight_kg: 40 },
        { reps: 8, weight_kg: 45 },
      ])
    ).toBe(760);
  });
});

describe('sessionMetrics', () => {
  it('liefert Maxima pro Kennzahl', () => {
    const metrics = sessionMetrics(ex(), [
      { reps: 10, weight_kg: 40 },
      { reps: 5, weight_kg: 50 },
    ]);
    expect(metrics.max_weight).toBe(50);
    expect(metrics.max_reps).toBe(10);
    expect(metrics.volume).toBe(650);
    expect(metrics.max_e1rm).toBeCloseTo(58.3, 1);
  });

  it('setzt volume nur für Gewichtsübungen', () => {
    expect(sessionMetrics(ex({ type: 'bw' }), [{ reps: 12 }]).volume).toBeNull();
  });
});

describe('bestsForExercise', () => {
  it('nimmt das Maximum über alle Sessions', () => {
    const bests = bestsForExercise(ex(), [
      session({ bench: [{ reps: 10, weight_kg: 40 }] }),
      session({ bench: [{ reps: 8, weight_kg: 45 }] }),
    ]);
    expect(bests.max_weight).toBe(45);
    expect(bests.volume).toBe(400);
  });
});

describe('detectNewRecords', () => {
  const plan = (exercises) => ({
    schema_version: 1,
    name: 'P',
    days: [{ key: 'push', name: 'Push', focus: '', exercises }],
  });

  it('erste Session einer Übung ist kein Rekord', () => {
    const records = detectNewRecords(
      plan([ex()]),
      new Map([['bench', [{ reps: 10, weight_kg: 40 }]]]),
      []
    );
    expect(records).toEqual([]);
  });

  it('erkennt einen Gewichts-Rekord', () => {
    const records = detectNewRecords(
      plan([ex()]),
      new Map([['bench', [{ reps: 8, weight_kg: 45 }]]]),
      [session({ bench: [{ reps: 10, weight_kg: 40 }] })]
    );
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      exercise_id: 'bench',
      kind: 'weight',
      unit: 'kg',
      value: 45,
      previous: 40,
    });
  });

  it('meldet e1RM, wenn das Gewicht gleich bleibt aber die Wiederholungen steigen', () => {
    const records = detectNewRecords(
      plan([ex()]),
      new Map([['bench', [{ reps: 12, weight_kg: 40 }]]]),
      [session({ bench: [{ reps: 10, weight_kg: 40 }] })]
    );
    expect(records[0].kind).toBe('e1rm');
  });

  it('meldet Volumen, wenn Gewicht und e1RM gleich bleiben', () => {
    const records = detectNewRecords(
      plan([ex()]),
      new Map([
        [
          'bench',
          [
            { reps: 10, weight_kg: 40 },
            { reps: 10, weight_kg: 40 },
          ],
        ],
      ]),
      [session({ bench: [{ reps: 10, weight_kg: 40 }] })]
    );
    expect(records[0]).toMatchObject({ kind: 'volume', value: 800, previous: 400 });
  });

  it('meldet höchstens einen Rekord pro Übung', () => {
    const records = detectNewRecords(
      plan([ex()]),
      new Map([
        [
          'bench',
          [
            { reps: 12, weight_kg: 50 },
            { reps: 12, weight_kg: 50 },
          ],
        ],
      ]),
      [session({ bench: [{ reps: 8, weight_kg: 40 }] })]
    );
    expect(records).toHaveLength(1);
    expect(records[0].kind).toBe('weight');
  });

  it('erkennt Wiederholungs- und Dauer-Rekorde', () => {
    const bw = ex({ id: 'pu', name: 'Liegestütze', type: 'bw', default_weight_kg: null });
    const time = ex({ id: 'plank', name: 'Plank', type: 'time', target_reps: null, target_seconds: 30, default_weight_kg: null });

    const records = detectNewRecords(
      plan([bw, time]),
      new Map([
        ['pu', [{ reps: 15 }]],
        ['plank', [{ duration_s: 60 }]],
      ]),
      [session({ pu: [{ reps: 12 }], plank: [{ duration_s: 45 }] })]
    );

    expect(records.find((r) => r.exercise_id === 'pu')).toMatchObject({ kind: 'reps', value: 15, unit: 'Wdh.' });
    expect(records.find((r) => r.exercise_id === 'plank')).toMatchObject({ kind: 'duration', value: 60, unit: 's' });
  });

  it('ignoriert Cooldown-Übungen', () => {
    const stretch = ex({ id: 'stretch', name: 'Dehnung', type: 'time', target_reps: null, target_seconds: 45, default_weight_kg: null, phase: 'cooldown' });
    const records = detectNewRecords(
      plan([stretch]),
      new Map([['stretch', [{ duration_s: 90 }]]]),
      [session({ stretch: [{ duration_s: 45 }] })]
    );
    expect(records).toEqual([]);
  });

  it('ignoriert Übungen, die nicht im Plan stehen', () => {
    const records = detectNewRecords(
      plan([ex()]),
      new Map([['fremd', [{ reps: 10, weight_kg: 100 }]]]),
      [session({ fremd: [{ reps: 5, weight_kg: 50 }] })]
    );
    expect(records).toEqual([]);
  });
});

// ---------- API ----------

function apiPlan() {
  return {
    schema_version: 1,
    name: 'Test Plan',
    days: [
      {
        key: 'push',
        name: 'Push',
        focus: 'Brust',
        exercises: [
          ex(),
          ex({ id: 'pu', name: 'Liegestütze', muscle: 'Brust', type: 'bw', default_weight_kg: null }),
          ex({
            id: 'stretch-brust',
            name: 'Brustdehnung',
            muscle: 'Brust',
            type: 'time',
            sets: 1,
            target_reps: null,
            target_seconds: 45,
            default_weight_kg: null,
            phase: 'cooldown',
          }),
        ],
      },
    ],
  };
}

async function login(app) {
  const res = await request(app).post('/api/login').send({ email: 'tuncay@example.com', password: 'password1' });
  return res.headers['set-cookie'][0];
}

async function finishSession(app, cookie, dayKey, sets) {
  const sessionRes = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: dayKey });
  const sessionId = sessionRes.body.session_id;
  for (const set of sets) {
    await request(app).post(`/api/sessions/${sessionId}/sets`).set('Cookie', cookie).send(set);
  }
  const finishRes = await request(app).post(`/api/sessions/${sessionId}/finish`).set('Cookie', cookie);
  return finishRes.body;
}

describe('POST /api/sessions/:id/finish -> new_records', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    cookie = await login(app);
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
  });

  it('erste Session liefert keine Rekorde', async () => {
    const body = await finishSession(app, cookie, 'push', [
      { exercise_id: 'bench', set_number: 1, reps: 10, weight_kg: 40, duration_s: null },
    ]);
    expect(body.new_records).toEqual([]);
  });

  it('zweite Session mit mehr Gewicht liefert einen Rekord', async () => {
    await finishSession(app, cookie, 'push', [
      { exercise_id: 'bench', set_number: 1, reps: 10, weight_kg: 40, duration_s: null },
    ]);
    const body = await finishSession(app, cookie, 'push', [
      { exercise_id: 'bench', set_number: 1, reps: 8, weight_kg: 45, duration_s: null },
    ]);
    expect(body.new_records).toHaveLength(1);
    expect(body.new_records[0]).toMatchObject({ exercise_id: 'bench', kind: 'weight', value: 45, previous: 40 });
  });

  it('Cooldown-Übungen erzeugen keine Rekorde', async () => {
    await finishSession(app, cookie, 'push', [
      { exercise_id: 'stretch-brust', set_number: 1, reps: null, weight_kg: null, duration_s: 45 },
    ]);
    const body = await finishSession(app, cookie, 'push', [
      { exercise_id: 'stretch-brust', set_number: 1, reps: null, weight_kg: null, duration_s: 120 },
    ]);
    expect(body.new_records).toEqual([]);
  });
});

describe('GET /api/stats', () => {
  let app;
  let cookie;

  beforeEach(async () => {
    ({ app } = setupTestApp());
    cookie = await login(app);
  });

  it('ohne Plan -> 404', async () => {
    const res = await request(app).get('/api/stats').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('ohne Cookie -> 401', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(401);
  });

  it('liefert Sessions, Tonnage, Muskelvolumen und Bestwerte', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());

    await finishSession(app, cookie, 'push', [
      { exercise_id: 'bench', set_number: 1, reps: 10, weight_kg: 40, duration_s: null },
      { exercise_id: 'bench', set_number: 2, reps: 8, weight_kg: 45, duration_s: null },
      { exercise_id: 'pu', set_number: 1, reps: 12, weight_kg: null, duration_s: null },
      { exercise_id: 'stretch-brust', set_number: 1, reps: null, weight_kg: null, duration_s: 45 },
    ]);

    const res = await request(app).get('/api/stats').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.plan_days).toBe(1);
    expect(res.body.sessions).toHaveLength(1);

    // 10x40 + 8x45 = 760; Liegestütze und Cooldown liefern keine Tonnage
    expect(res.body.sessions[0].tonnage_kg).toBe(760);
    // 3 Sätze aus dem Hauptteil, Cooldown zählt nicht
    expect(res.body.sessions[0].sets).toBe(3);

    const brust = res.body.volume_by_muscle.find((m) => m.muscle === 'Brust');
    expect(brust).toMatchObject({ sets: 3, tonnage_kg: 760 });

    const bench = res.body.records.find((r) => r.exercise_id === 'bench');
    expect(bench).toMatchObject({ max_weight: 45, max_reps: 10, volume: 760, sessions_count: 1 });

    // Cooldown steht nicht in den Bestwerten
    expect(res.body.records.find((r) => r.exercise_id === 'stretch-brust')).toBeUndefined();
  });

  it('trennt Nutzer', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
    await finishSession(app, cookie, 'push', [
      { exercise_id: 'bench', set_number: 1, reps: 10, weight_kg: 40, duration_s: null },
    ]);

    const otherRes = await request(app).post('/api/login').send({ email: 'partnerin@example.com', password: 'password2' });
    const otherCookie = otherRes.headers['set-cookie'][0];
    const res = await request(app).get('/api/stats').set('Cookie', otherCookie);
    expect(res.status).toBe(404);
  });
});
