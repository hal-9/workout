import { describe, it, expect } from 'vitest';
import { getDb, resetDb } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('migration runner', () => {
  it('is idempotent across repeated runs', () => {
    process.env.DATABASE_PATH = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'workout-migrate-')),
      'test.db'
    );
    resetDb();
    const db = getDb();

    runMigrations(db);
    runMigrations(db);

    const count = db
      .prepare('SELECT COUNT(*) AS c FROM schema_migrations')
      .get().c;
    expect(count).toBe(1);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
      .all();
    expect(tables).toHaveLength(1);
  });
});
