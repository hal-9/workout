import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { buildProgressForUser } from '../progress.js';

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

    const progress = buildProgressForUser(db, user.id);
    if (!progress) {
      return res.status(404).json({ error: 'no active plan' });
    }

    res.json({ name: user.name, ...progress });
  });

  return router;
}
