import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { normalizeEmail } from '../accounts.js';
import { listFriends, findEdge } from '../friends.js';

const requestSchema = z.object({ email: z.string().email() });

export function friendsRouter(db) {
  const router = Router();
  router.use(requireAuth(db));

  router.get('/friends', (req, res) => {
    const me = req.user.id;

    const incoming = db
      .prepare(
        `SELECT friendships.id, users.id AS user_id, users.name, friendships.created_at
         FROM friendships
         JOIN users ON users.id = friendships.requester_id
         WHERE friendships.addressee_id = ? AND friendships.status = 'pending'
         ORDER BY friendships.created_at DESC`
      )
      .all(me);

    const outgoing = db
      .prepare(
        `SELECT friendships.id, users.id AS user_id, users.name, friendships.created_at
         FROM friendships
         JOIN users ON users.id = friendships.addressee_id
         WHERE friendships.requester_id = ? AND friendships.status = 'pending'
         ORDER BY friendships.created_at DESC`
      )
      .all(me);

    res.json({ friends: listFriends(db, me), incoming, outgoing });
  });

  router.post('/friends/requests', (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }

    const email = normalizeEmail(parsed.data.email);
    const target = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
    if (!target) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (target.id === req.user.id) {
      return res.status(422).json({ error: 'cannot befriend yourself' });
    }

    const existing = findEdge(db, req.user.id, target.id);
    if (existing) {
      // Gegenanfrage: die offene Anfrage der anderen Seite direkt annehmen.
      if (existing.status === 'pending' && existing.addressee_id === req.user.id) {
        db.prepare(
          "UPDATE friendships SET status = 'accepted', responded_at = datetime('now') WHERE id = ?"
        ).run(existing.id);
        return res.status(200).json({ id: existing.id, status: 'accepted', name: target.name });
      }
      return res.status(409).json({ error: existing.status });
    }

    const info = db
      .prepare(
        "INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')"
      )
      .run(req.user.id, target.id);

    res.status(201).json({ id: info.lastInsertRowid, status: 'pending', name: target.name });
  });

  router.post('/friends/requests/:id/accept', (req, res) => {
    const row = db
      .prepare("SELECT * FROM friendships WHERE id = ? AND status = 'pending'")
      .get(req.params.id);
    if (!row || row.addressee_id !== req.user.id) {
      return res.status(404).json({ error: 'not found' });
    }

    db.prepare(
      "UPDATE friendships SET status = 'accepted', responded_at = datetime('now') WHERE id = ?"
    ).run(row.id);
    res.status(200).json({ id: row.id, status: 'accepted' });
  });

  // Ablehnen (eingehend) und Zurueckziehen (ausgehend) loeschen die Zeile,
  // damit spaeter erneut angefragt werden kann.
  router.delete('/friends/requests/:id', (req, res) => {
    const row = db
      .prepare("SELECT * FROM friendships WHERE id = ? AND status = 'pending'")
      .get(req.params.id);
    if (!row || (row.addressee_id !== req.user.id && row.requester_id !== req.user.id)) {
      return res.status(404).json({ error: 'not found' });
    }

    db.prepare('DELETE FROM friendships WHERE id = ?').run(row.id);
    res.status(204).end();
  });

  router.delete('/friends/:userId', (req, res) => {
    const otherId = Number(req.params.userId);
    const edge = findEdge(db, req.user.id, otherId);
    if (!edge || edge.status !== 'accepted') {
      return res.status(404).json({ error: 'not found' });
    }

    db.prepare('DELETE FROM friendships WHERE id = ?').run(edge.id);
    res.status(204).end();
  });

  return router;
}
