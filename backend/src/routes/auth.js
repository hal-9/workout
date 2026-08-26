import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { THEME_MODES, THEME_PALETTE_IDS } from 'shared/themes';
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
  SESSION_COOKIE,
} from '../auth.js';
import {
  registerSchema,
  normalizeEmail,
  inviteCodeMatches,
  createUser,
  findUserForLogin,
} from '../accounts.js';

const themeSchema = z.object({
  mode: z.enum(THEME_MODES),
  palette: z.enum(THEME_PALETTE_IDS),
});

// Karten-IDs kommen aus dem Frontend; nicht gegen eine feste Liste validieren,
// damit neue Karten keinen Backend-Deploy brauchen.
const progressLayoutSchema = z.object({
  order: z.array(z.string().min(1).max(40)).max(50),
  hidden: z.array(z.string().min(1).max(40)).max(50),
});

function publicUser(db, userId) {
  const row = db
    .prepare(
      'SELECT id, name, email, onboarded_at, theme_mode, theme_palette, progress_layout_json FROM users WHERE id = ?'
    )
    .get(userId);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    onboarded: Boolean(row.onboarded_at),
    // null = noch nie etwas gewaehlt; das Frontend behaelt dann seine lokale Auswahl.
    theme: { mode: row.theme_mode, palette: row.theme_palette },
    progress_layout: row.progress_layout_json ? JSON.parse(row.progress_layout_json) : null,
  };
}

export function authRouter(db) {
  const router = Router();

  router.post('/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }

    const { name, email, password, invite_code } = parsed.data;
    if (!inviteCodeMatches(invite_code)) {
      return res.status(403).json({ error: 'invalid invite code' });
    }

    if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(name)) {
      return res.status(409).json({ error: 'name taken' });
    }
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalizeEmail(email))) {
      return res.status(409).json({ error: 'email taken' });
    }

    const user = createUser(db, { name, email, password });
    const { token } = createSession(db, user.id);
    setSessionCookie(res, token);
    res.status(201).json(publicUser(db, user.id));
  });

  router.post('/login', (req, res) => {
    const { email, name, password } = req.body || {};
    const user = findUserForLogin(db, email ?? name);

    if (!user || !bcrypt.compareSync(password || '', user.password_digest)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const { token } = createSession(db, user.id);
    setSessionCookie(res, token);
    res.json(publicUser(db, user.id));
  });

  router.post('/logout', requireAuth(db), (req, res) => {
    const token = req.cookies[SESSION_COOKIE];
    db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', requireAuth(db), (req, res) => {
    res.json(publicUser(db, req.user.id));
  });

  router.post('/me/onboarded', requireAuth(db), (req, res) => {
    db.prepare(
      "UPDATE users SET onboarded_at = datetime('now') WHERE id = ? AND onboarded_at IS NULL"
    ).run(req.user.id);
    res.json(publicUser(db, req.user.id));
  });

  router.put('/me/progress-layout', requireAuth(db), (req, res) => {
    const parsed = progressLayoutSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }

    db.prepare('UPDATE users SET progress_layout_json = ? WHERE id = ?').run(
      JSON.stringify(parsed.data),
      req.user.id
    );
    res.json(publicUser(db, req.user.id));
  });

  router.put('/me/theme', requireAuth(db), (req, res) => {
    const parsed = themeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(422).json({ error: 'validation failed', details: parsed.error.issues });
    }

    const { mode, palette } = parsed.data;
    db.prepare('UPDATE users SET theme_mode = ?, theme_palette = ? WHERE id = ?').run(
      mode,
      palette,
      req.user.id
    );
    res.json(publicUser(db, req.user.id));
  });

  return router;
}
