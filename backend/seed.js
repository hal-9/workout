import bcrypt from 'bcrypt';
import { getDb } from './src/db.js';
import { runMigrations } from './src/migrate.js';
import { normalizeEmail } from './src/accounts.js';

function seedUser(db, name, password, email) {
  if (!name || !password) {
    throw new Error('missing seed user name/password ENV vars');
  }
  const existing = db.prepare('SELECT id, email FROM users WHERE name = ?').get(name);
  if (existing) {
    // Backfill: Bestandsnutzer bekommen ihre Login-E-Mail nachgetragen.
    if (email && !existing.email) {
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(normalizeEmail(email), existing.id);
      console.log(`set email for existing user "${name}"`);
    } else {
      console.log(`user "${name}" already exists, skipping`);
    }
    return;
  }
  const digest = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO users (name, email, password_digest) VALUES (?, ?, ?)').run(
    name,
    email ? normalizeEmail(email) : null,
    digest
  );
  console.log(`seeded user "${name}"`);
}

const db = getDb();
runMigrations(db);

for (let i = 1; process.env[`SEED_USER${i}_NAME`]; i++) {
  seedUser(
    db,
    process.env[`SEED_USER${i}_NAME`],
    process.env[`SEED_USER${i}_PASSWORD`],
    process.env[`SEED_USER${i}_EMAIL`]
  );
}
