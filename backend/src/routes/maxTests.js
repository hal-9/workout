import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';

const maxTestSchema = z.object({
  kind: z.enum(['pushups', 'pullup_stage', 'bodyweight']),
  value: z.number(),
  date: z.string().optional(),
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function maxTestsRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.post('/max-tests', (req, res) => {
    const result = maxTestSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({ error: 'validation failed', details: result.error.issues });
    }
    const { kind, value, date } = result.data;

    const info = db
      .prepare('INSERT INTO max_tests (user_id, kind, value, date) VALUES (?, ?, ?, ?)')
      .run(req.user.id, kind, value, date || today());

    res.status(201).json({ id: info.lastInsertRowid });
  });

  router.get('/max-tests', (req, res) => {
    const { kind } = req.query;

    const rows = kind
      ? db
          .prepare(
            'SELECT id, kind, value, date FROM max_tests WHERE user_id = ? AND kind = ? ORDER BY date ASC'
          )
          .all(req.user.id, kind)
      : db
          .prepare('SELECT id, kind, value, date FROM max_tests WHERE user_id = ? ORDER BY date ASC')
          .all(req.user.id);

    res.json(rows);
  });

  return router;
}
