import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import {
  applyProposalsForUser,
  buildProposalsForUser,
  listUnavailableForUser,
  markUnavailableForUser,
  removeUnavailableForUser,
  snoozeProposalsForUser,
} from '../progression.js';

const applySchema = z.object({
  exercise_ids: z.array(z.string().min(1)).min(1),
});

const unavailableSchema = z.object({ exercise_id: z.string().min(1) });
const removeUnavailableSchema = z.object({
  equipment: z.string().min(1).max(100),
  weight_kg: z.number().positive().finite(),
});

export function progressionRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/progression/proposals', (req, res) => {
    const result = buildProposalsForUser(db, req.user.id);
    if (!result) {
      return res.status(404).json({ error: 'no active plan' });
    }
    res.json(result);
  });

  router.post('/progression/apply', (req, res) => {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }

    const result = applyProposalsForUser(db, req.user.id, parsed.data.exercise_ids);
    if (result.error === 'no active plan') {
      return res.status(404).json({ error: result.error });
    }
    if (result.error) {
      return res.status(409).json({ error: result.error });
    }

    res.status(201).json(result);
  });

  router.post('/progression/snooze', (req, res) => {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }

    const result = snoozeProposalsForUser(db, req.user.id, parsed.data.exercise_ids);
    if (result.error === 'no active plan') {
      return res.status(404).json({ error: result.error });
    }
    if (result.error) {
      return res.status(409).json({ error: result.error });
    }

    res.status(201).json(result);
  });

  router.post('/progression/unavailable', (req, res) => {
    const parsed = unavailableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }
    const result = markUnavailableForUser(db, req.user.id, parsed.data.exercise_id);
    if (result.error === 'no active plan') return res.status(404).json({ error: result.error });
    if (result.error) return res.status(409).json({ error: result.error });
    res.status(201).json(result);
  });

  router.get('/progression/unavailable', (req, res) => {
    res.json({ weights: listUnavailableForUser(db, req.user.id) });
  });

  router.delete('/progression/unavailable', (req, res) => {
    const parsed = removeUnavailableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }
    removeUnavailableForUser(db, req.user.id, parsed.data.equipment, parsed.data.weight_kg);
    res.status(204).end();
  });

  return router;
}
