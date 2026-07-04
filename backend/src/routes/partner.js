import { Router } from 'express';
import { requireAuth } from '../auth.js';

export function partnerRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/users', (req, res) => {
    const users = db
      .prepare('SELECT id, name FROM users WHERE id != ? ORDER BY name')
      .all(req.user.id);
    res.json(users);
  });

  router.get('/partner/progress', (req, res) => {
    const userId = Number(req.query.user_id);
    if (!userId) {
      return res.status(422).json({ error: 'user_id required' });
    }

    const user = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'not found' });
    }

    const max_tests = db
      .prepare('SELECT id, kind, value, date FROM max_tests WHERE user_id = ? ORDER BY date ASC')
      .all(user.id);

    res.json({ name: user.name, max_tests });
  });

  return router;
}
