import crypto from 'node:crypto';

const SESSION_COOKIE = 'session';
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'test',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  };
}

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    'INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).run(token, userId, expiresAt);
  return { token, expiresAt };
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, cookieOptions());
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
}

export function requireAuth(db) {
  return (req, res, next) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const row = db
      .prepare(
        `SELECT auth_sessions.id, auth_sessions.user_id, auth_sessions.expires_at,
                users.name AS user_name
         FROM auth_sessions
         JOIN users ON users.id = auth_sessions.user_id
         WHERE auth_sessions.token = ?`
      )
      .get(token);

    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const newExpiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare('UPDATE auth_sessions SET expires_at = ? WHERE id = ?').run(
      newExpiresAt,
      row.id
    );
    setSessionCookie(res, token);

    req.user = { id: row.user_id, name: row.user_name };
    next();
  };
}

export { SESSION_COOKIE };
