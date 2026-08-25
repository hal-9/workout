import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  applyProposals,
  deloadWeek,
  evaluateExercise,
  evaluatePlan,
  nextTargetReps,
  progressionConfig,
  sessionQualifies,
} from 'shared/progression';
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

const topSets = (weight = 40, count = 3) =>
  Array.from({ length: count }, () => ({ reps: 12, weight_kg: weight, duration_s: null }));

describe('progressionConfig', () => {
  it('liefert Voreinstellungen je Typ', () => {
    expect(progressionConfig(ex())).toMatchObject({ type: 'weight', increment: 2.5, after_success: 2 });
    expect(progressionConfig(ex({ type: 'bw' }))).toMatchObject({ type: 'reps' });
    expect(progressionConfig(ex({ type: 'time' }))).toMatchObject({ type: 'duration' });
    expect(progressionConfig(ex({ type: 'cardio' }))).toBeNull();
  });

  it('progression null schaltet die Automatik ab', () => {
    expect(progressionConfig(ex({ progression: null }))).toBeNull();
  });

  it('überschreibt einzelne Felder', () => {
    const config = progressionConfig(ex({ progression: { type: 'weight', increment: 5, after_success: 3 } }));
    expect(config).toMatchObject({ increment: 5, after_success: 3, deload_factor: 0.9 });
  });

  it('ignoriert Cooldown-Übungen', () => {
    expect(progressionConfig(ex({ phase: 'cooldown' }))).toBeNull();
  });
});

describe('sessionQualifies', () => {
  const config = progressionConfig(ex());

  it('verlangt alle geplanten Sätze am oberen Ende des Zielbereichs', () => {
    expect(sessionQualifies(ex(), config, topSets())).toBe(true);
    expect(sessionQualifies(ex(), config, topSets(40, 2))).toBe(false);
    expect(sessionQualifies(ex(), config, [{ reps: 12 }, { reps: 12 }, { reps: 10, weight_kg: 40 }])).toBe(false);
  });

  it('verlangt mindestens das aktuelle Plan-Gewicht', () => {
    expect(sessionQualifies(ex(), config, topSets(35))).toBe(false);
    expect(sessionQualifies(ex(), config, topSets(45))).toBe(true);
  });

  it('prüft bei Zeit-Übungen die Zieldauer', () => {
    const plank = ex({ id: 'plank', type: 'time', target_reps: null, target_seconds: 30, default_weight_kg: null });
    const timeConfig = progressionConfig(plank);
    expect(sessionQualifies(plank, timeConfig, [{ duration_s: 30 }, { duration_s: 35 }, { duration_s: 40 }])).toBe(true);
    expect(sessionQualifies(plank, timeConfig, [{ duration_s: 30 }, { duration_s: 25 }, { duration_s: 40 }])).toBe(false);
  });
});

describe('nextTargetReps', () => {
  it('verschiebt Bereiche und Einzelwerte', () => {
    expect(nextTargetReps('8-12', 2)).toBe('10-14');
    expect(nextTargetReps('10', 2)).toBe('12');
    expect(nextTargetReps(null, 2)).toBeNull();
  });
});

describe('evaluateExercise', () => {
  const session = (sets) => ({ session_id: Math.random(), sets });

  it('schlägt erst nach der geforderten Serie vor', () => {
    expect(evaluateExercise(ex(), [session(topSets())])).toBeNull();
    const proposal = evaluateExercise(ex(), [session(topSets()), session(topSets())]);
    expect(proposal).toMatchObject({ exercise_id: 'bench', field: 'default_weight_kg', from: 40, to: 42.5, unit: 'kg' });
  });

  it('bricht die Serie bei einer schwachen Session ab', () => {
    const weak = session([{ reps: 8, weight_kg: 40 }, { reps: 8, weight_kg: 40 }, { reps: 8, weight_kg: 40 }]);
    expect(evaluateExercise(ex(), [session(topSets()), weak])).toBeNull();
  });

  it('nutzt nur die jüngsten Sessions der Serie', () => {
    const weak = session([{ reps: 8, weight_kg: 40 }]);
    const proposal = evaluateExercise(ex(), [weak, session(topSets()), session(topSets())]);
    expect(proposal.to).toBe(42.5);
  });

  it('schlägt bei Körpergewicht mehr Wiederholungen vor', () => {
    const pu = ex({ id: 'pu', type: 'bw', default_weight_kg: null, target_reps: '8-12' });
    const sets = Array.from({ length: 3 }, () => ({ reps: 12 }));
    const proposal = evaluateExercise(pu, [session(sets), session(sets)]);
    expect(proposal).toMatchObject({ field: 'target_reps', from: '8-12', to: '10-14', unit: 'Wdh.' });
  });

  it('schlägt bei Zeit-Übungen mehr Sekunden vor', () => {
    const plank = ex({ id: 'plank', type: 'time', target_reps: null, target_seconds: 30, default_weight_kg: null });
    const sets = Array.from({ length: 3 }, () => ({ duration_s: 35 }));
    const proposal = evaluateExercise(plank, [session(sets), session(sets)]);
    expect(proposal).toMatchObject({ field: 'target_seconds', from: 30, to: 40, unit: 's' });
  });

  it('liefert nichts für Cardio und abgeschaltete Übungen', () => {
    const cardio = ex({ id: 'tm', type: 'cardio', target_reps: null, target_seconds: 900, default_weight_kg: null });
    const sets = Array.from({ length: 3 }, () => ({ duration_s: 1200 }));
    expect(evaluateExercise(cardio, [session(sets), session(sets)])).toBeNull();
    expect(evaluateExercise(ex({ progression: null }), [session(topSets()), session(topSets())])).toBeNull();
  });
});

describe('evaluatePlan / applyProposals', () => {
  const plan = () => ({
    schema_version: 1,
    name: 'P',
    days: [
      {
        key: 'push',
        name: 'Push',
        focus: '',
        exercises: [
          ex(),
          ex({ id: 'stretch', name: 'Dehnung', type: 'time', target_reps: null, target_seconds: 45, default_weight_kg: null, phase: 'cooldown' }),
        ],
      },
    ],
  });

  const sessionWith = (id, setsByExercise) => ({ session_id: id, setsByExercise: new Map(Object.entries(setsByExercise)) });

  it('sammelt Vorschläge und lässt Cooldown aus', () => {
    const sessions = [
      sessionWith(1, { bench: topSets(), stretch: [{ duration_s: 90 }] }),
      sessionWith(2, { bench: topSets(), stretch: [{ duration_s: 90 }] }),
    ];
    const proposals = evaluatePlan(plan(), sessions);
    expect(proposals.map((p) => p.exercise_id)).toEqual(['bench']);
  });

  it('erzeugt eine neue Plan-Version ohne den alten Plan zu verändern', () => {
    const original = plan();
    const next = applyProposals(original, [{ exercise_id: 'bench', field: 'default_weight_kg', to: 42.5 }]);
    expect(next.days[0].exercises[0].default_weight_kg).toBe(42.5);
    expect(original.days[0].exercises[0].default_weight_kg).toBe(40);
  });

  it('gibt den Plan unverändert zurück, wenn nichts angenommen wurde', () => {
    const original = plan();
    expect(applyProposals(original, [])).toBe(original);
  });
});

describe('deloadWeek', () => {
  const planWith = (progression) => ({
    schema_version: 1,
    name: 'P',
    days: [{ key: 'd', name: 'D', focus: '', exercises: [ex({ progression })] }],
  });

  const start = Date.parse('2026-01-05T00:00:00Z');
  const weeksLater = (n) => start + n * 7 * 24 * 3600 * 1000;

  it('bleibt ohne Konfiguration still', () => {
    expect(deloadWeek(planWith(undefined), start, weeksLater(6))).toBeNull();
  });

  it('greift in der konfigurierten Woche', () => {
    const plan = planWith({ type: 'weight', increment: 2.5, deload_every_weeks: 5, deload_factor: 0.9 });
    expect(deloadWeek(plan, start, weeksLater(4))).toBeNull();
    expect(deloadWeek(plan, start, weeksLater(5))).toMatchObject({ week: 5, every: 5, factor: 0.9 });
    expect(deloadWeek(plan, start, weeksLater(10))).toMatchObject({ week: 10 });
  });

  it('verkraftet fehlende Zeitangaben', () => {
    const plan = planWith({ type: 'weight', increment: 2.5, deload_every_weeks: 5 });
    expect(deloadWeek(plan, null, weeksLater(5))).toBeNull();
  });
});

// ---------- API ----------

function apiPlan(overrides = {}) {
  return {
    schema_version: 1,
    name: 'Test Plan',
    days: [
      {
        key: 'push',
        name: 'Push',
        focus: 'Brust',
        exercises: [ex(overrides)],
      },
    ],
  };
}

async function login(app, email = 'tuncay@example.com', password = 'password1') {
  const res = await request(app).post('/api/login').send({ email, password });
  return res.headers['set-cookie'][0];
}

async function finishSession(app, cookie, sets) {
  const s = await request(app).post('/api/sessions').set('Cookie', cookie).send({ day_key: 'push' });
  for (const set of sets) {
    await request(app).post(`/api/sessions/${s.body.session_id}/sets`).set('Cookie', cookie).send(set);
  }
  await request(app).post(`/api/sessions/${s.body.session_id}/finish`).set('Cookie', cookie).send({});
}

const topApiSets = (weight = 40) =>
  [1, 2, 3].map((set_number) => ({ exercise_id: 'bench', set_number, reps: 12, weight_kg: weight, duration_s: null }));

describe('Progression API', () => {
  let app;
  let db;
  let cookie;

  beforeEach(async () => {
    ({ app, db } = setupTestApp());
    cookie = await login(app);
  });

  it('ohne Plan -> 404, ohne Cookie -> 401', async () => {
    expect((await request(app).get('/api/progression/proposals').set('Cookie', cookie)).status).toBe(404);
    expect((await request(app).get('/api/progression/proposals')).status).toBe(401);
  });

  it('liefert nach zwei starken Sessions einen Vorschlag', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
    await finishSession(app, cookie, topApiSets());

    const early = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(early.body.proposals).toEqual([]);

    await finishSession(app, cookie, topApiSets());
    const res = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(res.body.proposals).toHaveLength(1);
    expect(res.body.proposals[0]).toMatchObject({ exercise_id: 'bench', from: 40, to: 42.5 });
    expect(res.body.deload).toBeNull();
  });

  it('apply legt eine neue Plan-Version an und behält die alte inaktiv', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
    await finishSession(app, cookie, topApiSets());
    await finishSession(app, cookie, topApiSets());

    const before = db.prepare('SELECT id FROM plans WHERE user_id = 1 AND active = 1').get();
    const res = await request(app)
      .post('/api/progression/apply')
      .set('Cookie', cookie)
      .send({ exercise_ids: ['bench'] });

    expect(res.status).toBe(201);
    expect(res.body.applied[0]).toMatchObject({ exercise_id: 'bench', to: 42.5 });

    const plans = db.prepare('SELECT id, active FROM plans WHERE user_id = 1 ORDER BY id').all();
    expect(plans).toHaveLength(2);
    expect(plans.find((p) => p.id === before.id).active).toBe(0);

    const activePlan = await request(app).get('/api/plan').set('Cookie', cookie);
    expect(activePlan.body.days[0].exercises[0].default_weight_kg).toBe(42.5);

    // Danach gibt es keinen offenen Vorschlag mehr — die Sessions hängen an der alten Version
    const after = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(after.body.proposals).toEqual([]);
  });

  it('apply ohne passenden Vorschlag -> 409', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
    const res = await request(app)
      .post('/api/progression/apply')
      .set('Cookie', cookie)
      .send({ exercise_ids: ['bench'] });
    expect(res.status).toBe(409);
  });

  it('apply validiert den Body', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
    expect((await request(app).post('/api/progression/apply').set('Cookie', cookie).send({})).status).toBe(422);
    expect(
      (await request(app).post('/api/progression/apply').set('Cookie', cookie).send({ exercise_ids: [] })).status
    ).toBe(422);
  });

  it('rechnet Werte serverseitig — Client-Zahlen werden ignoriert', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
    await finishSession(app, cookie, topApiSets());
    await finishSession(app, cookie, topApiSets());

    await request(app)
      .post('/api/progression/apply')
      .set('Cookie', cookie)
      .send({ exercise_ids: ['bench'], to: 999, proposals: [{ exercise_id: 'bench', to: 999 }] });

    const activePlan = await request(app).get('/api/plan').set('Cookie', cookie);
    expect(activePlan.body.days[0].exercises[0].default_weight_kg).toBe(42.5);
  });

  it('respektiert progression: null im Plan', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan({ progression: null }));
    await finishSession(app, cookie, topApiSets());
    await finishSession(app, cookie, topApiSets());
    const res = await request(app).get('/api/progression/proposals').set('Cookie', cookie);
    expect(res.body.proposals).toEqual([]);
  });

  it('trennt Nutzer', async () => {
    await request(app).post('/api/plan').set('Cookie', cookie).send(apiPlan());
    await finishSession(app, cookie, topApiSets());
    await finishSession(app, cookie, topApiSets());

    const otherCookie = await login(app, 'partnerin@example.com', 'password2');
    expect((await request(app).get('/api/progression/proposals').set('Cookie', otherCookie)).status).toBe(404);
    expect(
      (await request(app).post('/api/progression/apply').set('Cookie', otherCookie).send({ exercise_ids: ['bench'] })).status
    ).toBe(404);
  });
});
