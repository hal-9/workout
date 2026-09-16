import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { COACH_FIELDS, validHintValue } from '../evaluation.js';
import { parseAdaptations, sessionExerciseMeta } from '../sessionExercises.js';

const hintsSchema = z.object({
  session_id: z.number().int().positive(),
  hints: z
    .array(
      z.object({
        exercise_id: z.string().min(1),
        field: z.enum(COACH_FIELDS),
        value: z.number(),
      })
    )
    .min(1)
    .max(10),
});

/**
 * Übernommene Coach-Empfehlungen. Ein Tipp gilt für die nächste Session mit
 * der Übung (Prefill über /history) und wird beim Finish dieser Session gelöscht.
 * Werte werden gegen die Übung der Quell-Session geprüft — der Client kann
 * keine beliebigen Zahlen für beliebige Ids ablegen.
 */
export function coachRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.post('/coach/hints', (req, res) => {
    const parsed = hintsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }

    const session = db
      .prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?')
      .get(parsed.data.session_id, req.user.id);
    if (!session) return res.status(404).json({ error: 'not found' });

    const planRow = db.prepare('SELECT json_payload FROM plans WHERE id = ?').get(session.plan_id);
    const day = planRow ? JSON.parse(planRow.json_payload).days.find((d) => d.key === session.day_key) : null;
    const meta = sessionExerciseMeta(day, parseAdaptations(session.adaptations_json));

    const invalid = parsed.data.hints.find(
      (hint) => !meta.has(hint.exercise_id) || !validHintValue(meta.get(hint.exercise_id).type ?? 'bw', hint.field, hint.value)
    );
    if (invalid) {
      return res.status(422).json({ error: 'hint does not match exercise', exercise_id: invalid.exercise_id });
    }

    const upsert = db.prepare(
      `INSERT INTO coach_hints (user_id, exercise_id, field, value, source_session_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id, exercise_id, field)
       DO UPDATE SET value = excluded.value, source_session_id = excluded.source_session_id, created_at = datetime('now')`
    );
    db.transaction(() => {
      for (const hint of parsed.data.hints) {
        upsert.run(req.user.id, hint.exercise_id, hint.field, hint.value, session.id);
      }
    })();

    res.status(201).json({ saved: parsed.data.hints });
  });

  return router;
}
