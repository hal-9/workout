import { Router } from 'express';
import bcrypt from 'bcrypt';
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  SESSION_COOKIE,
} from '../auth.js';

export function authRouter(db) {
  const router = Router();

  router.post('/login', (req, res) => {
    const { name, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE name = ?').get(name);

    if (!user || !bcrypt.compareSync(password || '', user.password_digest)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { token } = createSession(db, user.id);
    setSessionCookie(res, token);
    res.json({ id: user.id, name: user.name });
  });

  router.post('/logout', requireAuth(db), (req, res) => {
    const token = req.cookies[SESSION_COOKIE];
    db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth(db), (req, res) => {
    res.json({ id: req.user.id, name: req.user.name });
  });

  return router;
}
