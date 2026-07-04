import bcrypt from 'bcrypt';
import { getDb } from './src/db.js';
import { runMigrations } from './src/migrate.js';

function seedUser(db, name, password) {
  if (!name || !password) {
    throw new Error('missing seed user name/password ENV vars');
  }
  const existing = db.prepare('SELECT id FROM users WHERE name = ?').get(name);
  if (existing) {
    console.log(`user "${name}" already exists, skipping`);
    return;
  }
  const digest = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (name, password_digest) VALUES (?, ?)').run(name, digest);
  console.log(`seeded user "${name}"`);
}

const db = getDb();
runMigrations(db);

seedUser(db, process.env.SEED_USER1_NAME, process.env.SEED_USER1_PASSWORD);
seedUser(db, process.env.SEED_USER2_NAME, process.env.SEED_USER2_PASSWORD);
