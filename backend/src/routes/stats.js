import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { buildStatsForUser } from '../stats.js';

export function statsRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/stats', (req, res) => {
    const stats = buildStatsForUser(db, req.user.id);
    if (!stats) {
      return res.status(404).json({ error: 'no active plan' });
    }
    res.json(stats);
  });

  return router;
}
