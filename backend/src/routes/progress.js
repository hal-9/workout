import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { buildProgressForUser, buildProgressSummaryForUser } from '../progress.js';

export function progressRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/progress', (req, res) => {
    const progress = buildProgressForUser(db, req.user.id);
    if (!progress) {
      return res.status(404).json({ error: 'no active plan' });
    }
    res.json(progress);
  });

  router.get('/progress/summary', (req, res) => {
    const summary = buildProgressSummaryForUser(db, req.user.id);
    if (!summary) {
      return res.status(404).json({ error: 'no active plan' });
    }
    res.json(summary);
  });

  return router;
}
