import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { listFriends } from '../friends.js';

export function friendsActivityRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/friends/activity', (req, res) => {
    const me = req.user.id;
    const friends = listFriends(db, me);

    const activity = friends.map((friend) => {
      const lastSession = db
        .prepare(
          `SELECT day_key, finished_at FROM sessions
           WHERE user_id = ? AND status = 'finished'
           ORDER BY finished_at DESC LIMIT 1`
        )
        .get(friend.id);

      const weekCount = db
        .prepare(
          `SELECT COUNT(*) AS c FROM sessions
           WHERE user_id = ? AND status = 'finished' AND finished_at >= datetime('now', '-7 days')`
        )
        .get(friend.id)?.c ?? 0;

      return {
        user_id: friend.id,
        name: friend.name,
        last_workout: lastSession?.finished_at ?? null,
        last_day_key: lastSession?.day_key ?? null,
        workouts_this_week: weekCount,
      };
    });

    res.json({ activity });
  });

  return router;
}
