import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { buildStatsForUser, buildTreeForUser } from '../stats.js';

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

  // Wochen-Aggregate seit Account-Anfang — Datengrundlage des Trainingsbaums.
  // Braucht keinen aktiven Plan: Übungs-Metadaten kommen aus allen Plan-Versionen.
  router.get('/stats/tree', (req, res) => {
    res.json({ weeks: buildTreeForUser(db, req.user.id) });
  });

  return router;
}
