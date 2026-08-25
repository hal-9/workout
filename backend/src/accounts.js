import bcrypt from 'bcrypt';
import { z } from 'zod';

const BCRYPT_COST = 12;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(30),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(200),
  invite_code: z.string().min(1),
});

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

// Ohne gesetzten Invite-Code ist die Registrierung zu, nicht offen: fehlt die
// Env-Variable im Deploy, soll niemand durchkommen.
export function inviteCodeMatches(code) {
  const expected = process.env.REGISTER_INVITE_CODE;
  if (!expected) return false;
  return code === expected;
}

export function createUser(db, { name, email, password }) {
  const digest = bcrypt.hashSync(password, BCRYPT_COST);
  const info = db
    .prepare('INSERT INTO users (name, email, password_digest) VALUES (?, ?, ?)')
    .run(name, normalizeEmail(email), digest);
  return { id: Number(info.lastInsertRowid), name };
}

// E-Mail ist die Login-Kennung. Der Name-Fallback existiert nur fuer die
// Bestandsnutzer ohne E-Mail und kann nach dem Backfill weg.
export function findUserForLogin(db, identifier) {
  const value = String(identifier ?? '').trim();
  if (!value) return undefined;

  return (
    db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(value)) ||
    db.prepare('SELECT * FROM users WHERE name = ? AND email IS NULL').get(value)
  );
}
