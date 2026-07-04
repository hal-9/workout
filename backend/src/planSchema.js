import { z } from 'zod';

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
}).strip();

const daySchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  focus: z.string(),
  exercises: z.array(exerciseSchema).min(1),
}).strip();

export const planSchema = z.object({
  schema_version: z.literal(1),
  name: z.string().min(1),
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
