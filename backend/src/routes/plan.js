import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { planSchema } from '../planSchema.js';

export function planRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/plan', (req, res) => {
    const plan = db
      .prepare('SELECT id, json_payload FROM plans WHERE user_id = ? AND active = 1')
      .get(req.user.id);

    if (!plan) {
      return res.status(404).json({ error: 'no active plan' });
    }

    res.json({ ...JSON.parse(plan.json_payload), plan_id: plan.id });
  });

  router.post('/plan', (req, res) => {
    if (req.body?.schema_version !== 1) {
      return res.status(422).json({ error: 'unsupported schema_version' });
    }

    const result = planSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({
        error: 'validation failed',
        details: result.error.issues,
      });
    }

    const plan = result.data;
    const insert = db.transaction(() => {
      db.prepare('UPDATE plans SET active = 0 WHERE user_id = ?').run(req.user.id);
      const info = db
        .prepare(
          'INSERT INTO plans (user_id, name, schema_version, json_payload, active) VALUES (?, ?, ?, ?, 1)'
        )
        .run(req.user.id, plan.name, plan.schema_version, JSON.stringify(plan));
      return info.lastInsertRowid;
    });

    const planId = insert();
    res.status(201).json({ plan_id: planId });
  });

  return router;
}
