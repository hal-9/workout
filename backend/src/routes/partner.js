import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { buildProgressForUser } from '../progress.js';
import { areFriends, listFriends } from '../friends.js';

export function partnerRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/users', (req, res) => {
    res.json(listFriends(db, req.user.id));
  });

  router.get('/partner/progress', (req, res) => {
    const userId = Number(req.query.user_id);
    if (!userId) {
      return res.status(422).json({ error: 'user_id required' });
    }

    if (!areFriends(db, req.user.id, userId)) {
      return res.status(403).json({ error: 'forbidden' });
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
