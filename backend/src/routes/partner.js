import { Router } from 'express';
import { requireAuth } from '../auth.js';

export function partnerRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/partner/progress', (req, res) => {
    const partner = db.prepare('SELECT id, name FROM users WHERE id != ?').get(req.user.id);

    const max_tests = db
      .prepare('SELECT id, kind, value, date FROM max_tests WHERE user_id = ? ORDER BY date ASC')
      .all(partner.id);

    res.json({ name: partner.name, max_tests });
  });

  return router;
}
