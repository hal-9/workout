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
    { name: 'tuncay', password: 'password1' },
    { name: 'partnerin', password: 'password2' },
  ];
  for (const u of seedUsers) {
    db.prepare('INSERT INTO users (name, password_digest) VALUES (?, ?)').run(
      u.name,
      bcrypt.hashSync(u.password, 12)
    );
  }

  const app = createApp(db);
  return { app, db, seedUsers };
}
