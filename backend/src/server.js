import { createApp } from './app.js';
import { runMigrations } from './migrate.js';
import { getDb } from './db.js';

const db = getDb();
runMigrations(db);

const port = process.env.PORT || 3000;
const app = createApp(db);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
