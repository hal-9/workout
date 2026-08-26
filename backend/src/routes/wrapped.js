import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { buildWrappedForUser, isMonthKey, markWrappedSeen, wrappedStatus } from '../wrapped.js';

export function wrappedRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  // Speist den Banner auf Heute: Rückblick des Vormonats, falls dort trainiert wurde.
  router.get('/wrapped/latest', (req, res) => {
    res.json(wrappedStatus(db, req.user.id));
  });

  router.get('/wrapped', (req, res) => {
    const month = req.query.month;
    if (!isMonthKey(month)) {
      return res.status(422).json({ error: 'validation failed', details: 'month must be YYYY-MM' });
    }
    res.json(buildWrappedForUser(db, req.user.id, month));
  });

  router.post('/wrapped/:month/seen', (req, res) => {
    const month = req.params.month;
    if (!isMonthKey(month)) {
      return res.status(422).json({ error: 'validation failed', details: 'month must be YYYY-MM' });
    }
    markWrappedSeen(db, req.user.id, month);
    res.json({ ok: true });
  });

  return router;
}
