import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { getDb, resetDb } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';
import { createApp } from '../src/app.js';

export function setupTestApp() {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'workout-test-')),
    'test.db'
  );

  resetDb();
  const db = getDb();
  runMigrations(db);

  const seedUsers = [
    { name: 'tuncay', email: 'tuncay@example.com', password: 'password1' },
    { name: 'partnerin', email: 'partnerin@example.com', password: 'password2' },
    { name: 'fremde', email: 'fremde@example.com', password: 'password3' },
  ];
  for (const u of seedUsers) {
    // Bestandsnutzer: Onboarding schon gesehen.
    db.prepare(
      `INSERT INTO users (name, email, password_digest, onboarded_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run(u.name, u.email, bcrypt.hashSync(u.password, 12));
  }

  // tuncay und partnerin sind befreundet, "fremde" ist es mit niemandem.
  db.prepare(
    `INSERT INTO friendships (requester_id, addressee_id, status, responded_at)
     VALUES (
       (SELECT id FROM users WHERE name = 'tuncay'),
       (SELECT id FROM users WHERE name = 'partnerin'),
       'accepted',
       datetime('now')
     )`
  ).run();

  const app = createApp(db);
  return { app, db, seedUsers };
}
