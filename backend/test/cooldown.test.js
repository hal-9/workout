import { describe, it, expect } from 'vitest';
import { planSchema } from 'shared';
import { buildExerciseProgressList, isCooldown } from 'shared/exerciseProgress';
import {
  buildCooldownExercises,
  detectCooldownFocus,
  splitPhases,
  suggestCooldownForDay,
} from '../../frontend/src/lib/cooldown.js';
import { preparePlanForSave } from '../../frontend/src/lib/planDefaults.js';
import { evaluatePlan } from 'shared/progression';

function exercise(overrides = {}) {
  return {
    id: 'bankdruecken',
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

function plan(exercises, extra = {}) {
  return {
    schema_version: 1,
    name: 'Testplan',
    days: [{ key: 'push', name: 'Push', focus: 'Brust & Schulter', exercises }],
    ...extra,
  };
}

describe('planSchema: phase', () => {
  it('setzt phase auf main, wenn das Feld fehlt (Rückwärtskompatibilität)', () => {
    const parsed = planSchema.parse(plan([exercise()]));
    expect(parsed.days[0].exercises[0].phase).toBe('main');
  });

  it('akzeptiert phase cooldown', () => {
    const parsed = planSchema.parse(
      plan([exercise(), exercise({ id: 'stretch-brust', type: 'time', target_reps: null, target_seconds: 45, default_weight_kg: null, phase: 'cooldown' })])
    );
    expect(parsed.days[0].exercises[1].phase).toBe('cooldown');
  });

  it('lehnt unbekannte phase-Werte ab', () => {
    const result = planSchema.safeParse(plan([exercise({ phase: 'warmup' })]));
    expect(result.success).toBe(false);
  });
});

describe('planSchema: music_url', () => {
  it('akzeptiert eine URL, null und ein fehlendes Feld', () => {
    expect(planSchema.safeParse(plan([exercise()], { music_url: 'https://music.apple.com/de/playlist/x/pl.1' })).success).toBe(true);
    expect(planSchema.safeParse(plan([exercise()], { music_url: null })).success).toBe(true);
    expect(planSchema.safeParse(plan([exercise()])).success).toBe(true);
  });

  it('lehnt kaputte URLs ab', () => {
    expect(planSchema.safeParse(plan([exercise()], { music_url: 'nicht-mal-eine-url' })).success).toBe(false);
  });
});

describe('detectCooldownFocus', () => {
  it('erkennt einen Push-Tag', () => {
    expect(detectCooldownFocus({ focus: 'Brust & Schulter', name: 'Push', exercises: [] })).toContain('push');
  });

  it('erkennt gemischte Tage mit zwei Fokussen', () => {
    const keys = detectCooldownFocus({
      focus: 'Gesäß & Rumpf',
      name: 'Glutes/Core',
      exercises: [{ muscle: 'Gesäß', name: 'Hip Thrust' }, { muscle: 'Bauch', name: 'Plank' }],
    });
    expect(keys).toEqual(expect.arrayContaining(['glutes', 'core']));
    expect(keys).toHaveLength(2);
  });

  it('fällt auf Ganzkörper zurück', () => {
    expect(detectCooldownFocus({ focus: '', name: 'Tag 1', exercises: [] })).toEqual(['full']);
  });
});

describe('buildCooldownExercises', () => {
  it('liefert maximal vier Cooldown-Übungen mit phase cooldown', () => {
    const list = buildCooldownExercises(['legs', 'glutes']);
    expect(list).toHaveLength(4);
    expect(list.every((ex) => ex.phase === 'cooldown')).toBe(true);
    expect(list.every((ex) => ex.type === 'time' && ex.sets === 1 && ex.target_seconds > 0)).toBe(true);
  });

  it('entfernt Dubletten über Fokus-Grenzen hinweg', () => {
    const names = buildCooldownExercises(['legs', 'full']).map((ex) => ex.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('vergibt eindeutige Ids gegen bereits belegte Ids', () => {
    const existing = new Set(['stretch-kindhaltung']);
    const list = buildCooldownExercises(['core'], existing);
    expect(list.map((ex) => ex.id)).not.toContain('stretch-kindhaltung');
    expect(new Set(list.map((ex) => ex.id)).size).toBe(list.length);
  });

  it('erzeugt einen schema-validen Plan', () => {
    const day = { key: 'push', name: 'Push', focus: 'Brust & Schulter', exercises: [exercise()] };
    const cooldown = suggestCooldownForDay(day, new Set(day.exercises.map((e) => e.id)));
    const result = planSchema.safeParse(plan([...day.exercises, ...cooldown]));
    expect(result.success).toBe(true);
  });
});

describe('splitPhases', () => {
  it('trennt Hauptteil und Cooldown und behandelt fehlendes phase-Feld als main', () => {
    const { main, cooldown } = splitPhases([
      exercise(),
      exercise({ id: 'a', phase: 'main' }),
      exercise({ id: 'stretch', phase: 'cooldown' }),
    ]);
    expect(main).toHaveLength(2);
    expect(cooldown).toHaveLength(1);
  });
});

describe('Cooldown zählt nicht in Fortschritt und Progression', () => {
  const cooldownEx = exercise({
    id: 'stretch-brust',
    name: 'Brustdehnung',
    type: 'time',
    target_reps: null,
    target_seconds: 45,
    default_weight_kg: null,
    phase: 'cooldown',
  });

  it('isCooldown erkennt die Phase', () => {
    expect(isCooldown(cooldownEx)).toBe(true);
    expect(isCooldown(exercise())).toBe(false);
  });

  it('buildExerciseProgressList lässt Cooldown-Übungen aus', () => {
    const sessionLogs = [
      {
        session_id: 1,
        finished_at: '2026-08-10 18:00:00',
        setsByExercise: new Map([
          ['bankdruecken', [{ set_number: 1, reps: 10, weight_kg: 40, duration_s: null }]],
          ['stretch-brust', [{ set_number: 1, reps: null, weight_kg: null, duration_s: 45 }]],
        ]),
      },
    ];
    const { exercises } = buildExerciseProgressList(plan([exercise(), cooldownEx]), sessionLogs);
    expect(exercises.map((e) => e.exercise_id)).toEqual(['bankdruecken']);
  });

  it('evaluatePlan schlägt für Cooldown-Übungen nichts vor', () => {
    const strongSession = () => ({
      session_id: 1,
      setsByExercise: new Map([['stretch-brust', [{ duration_s: 120 }]]]),
    });
    expect(evaluatePlan(plan([exercise(), cooldownEx]), [strongSession(), strongSession()])).toEqual([]);
  });
});

describe('preparePlanForSave', () => {
  it('behält phase und normalisiert music_url', () => {
    const saved = preparePlanForSave({
      name: '  Plan  ',
      music_url: '  https://open.spotify.com/playlist/abc  ',
      days: [
        {
          key: 'push',
          name: ' Push ',
          focus: 'Brust',
          exercises: [exercise({ name: ' Bankdrücken ', muscle: ' Brust ' }), { ...exercise({ id: 'stretch', type: 'time', target_reps: null, target_seconds: 45, default_weight_kg: null, phase: 'cooldown' }) }],
        },
      ],
    });
    expect(saved.music_url).toBe('https://open.spotify.com/playlist/abc');
    expect(saved.days[0].exercises[1].phase).toBe('cooldown');
    expect(saved.days[0].exercises[0].phase).toBe('main');
    expect(planSchema.safeParse(saved).success).toBe(true);
  });

  it('macht aus leerer music_url null', () => {
    const saved = preparePlanForSave({ name: 'P', music_url: '   ', days: [{ key: 'a', name: 'A', focus: '', exercises: [exercise()] }] });
    expect(saved.music_url).toBeNull();
  });
});
