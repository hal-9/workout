import { z } from 'zod';

// Automatische Steigerung. `null` schaltet sie für die Übung ab,
// fehlendes Feld nutzt die Voreinstellung des Übungstyps.
const progressionSchema = z.object({
  type: z.enum(['weight', 'reps', 'duration']),
  increment: z.number().positive(),
  after_success: z.number().int().min(1).max(10).optional(),
  deload_every_weeks: z.number().int().min(2).max(52).nullable().optional(),
  deload_factor: z.number().min(0.5).max(1).optional(),
}).strip();

const exerciseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  muscle: z.string().min(1),
  type: z.enum(['bw', 'wt', 'time', 'cardio']),
  sets: z.number().int().min(1).max(20),
  target_reps: z.string().nullable(),
  target_seconds: z.number().int().positive().nullable(),
  default_weight_kg: z.number().positive().nullable(),
  cue: z.string(),
  video_query: z.string(),
  // 'cooldown' = Stretching/Abwärmen: zählt nicht in Volumen, PRs und Progression.
  phase: z.enum(['main', 'cooldown']).default('main'),
  progression: progressionSchema.nullable().optional(),
}).strip();

const daySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  focus: z.string(),
  weekday: z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']).nullable().optional(),
  exercises: z.array(exerciseSchema).min(1),
}).strip();

export const planSchema = z.object({
  schema_version: z.literal(1),
  name: z.string().min(1),
  // Optionaler Deep-Link auf eine Playlist (Apple Music, Spotify, beliebige URL).
  music_url: z.string().url().nullable().optional(),
  days: z.array(daySchema).min(1),
}).strip()
  .refine(
    (plan) => {
      const ids = plan.days.flatMap((d) => d.exercises.map((e) => e.id));
      return new Set(ids).size === ids.length;
    },
    { message: 'exercise ids must be unique within the plan' }
  )
  .refine(
    (plan) => new Set(plan.days.map((d) => d.key)).size === plan.days.length,
    { message: 'day keys must be unique within the plan' }
  );
