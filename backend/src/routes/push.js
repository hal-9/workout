import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import {
  PUSH_CATEGORIES,
  cancelPushTimer,
  deleteSubscription,
  pushEnabled,
  saveSubscription,
  schedulePushTimer,
} from '../push.js';

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
  categories: z.array(z.enum(PUSH_CATEGORIES)).max(PUSH_CATEGORIES.length),
});

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

const timerSchema = z.object({ seconds: z.number().int().min(5).max(900) });

export function pushRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/push/public-key', (req, res) => {
    if (!pushEnabled()) return res.status(503).json({ error: 'push not configured' });
    res.json({ public_key: process.env.VAPID_PUBLIC_KEY });
  });

  router.post('/push/subscribe', (req, res) => {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }
    saveSubscription(db, req.user.id, parsed.data.subscription, parsed.data.categories);
    res.json({ ok: true });
  });

  router.delete('/push/subscribe', (req, res) => {
    const parsed = unsubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }
    deleteSubscription(db, req.user.id, parsed.data.endpoint);
    res.json({ ok: true });
  });

  // Pausen-Timer-Push: geplant beim Wechsel in den Hintergrund, storniert beim
  // Zurückkommen. Ohne Push-Konfiguration ein No-Op mit ok: true.
  router.post('/push/timer', (req, res) => {
    const parsed = timerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }
    if (pushEnabled()) schedulePushTimer(db, req.user.id, parsed.data.seconds);
    res.json({ ok: true });
  });

  router.delete('/push/timer', (req, res) => {
    cancelPushTimer(req.user.id);
    res.json({ ok: true });
  });

  return router;
}
