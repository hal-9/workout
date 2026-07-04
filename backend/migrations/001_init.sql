CREATE TABLE users (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  password_digest TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE auth_sessions (
  id         INTEGER PRIMARY KEY,
  token      TEXT NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE plans (
  id             INTEGER PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  name           TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  json_payload   TEXT NOT NULL,
  active         INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  plan_id     INTEGER NOT NULL REFERENCES plans(id),
  day_key     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','finished','discarded')),
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE set_logs (
  id          INTEGER PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES sessions(id),
  exercise_id TEXT NOT NULL,
  set_number  INTEGER NOT NULL,
  reps        INTEGER,
  weight_kg   REAL,
  duration_s  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, exercise_id, set_number)
);

CREATE TABLE max_tests (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind    TEXT NOT NULL CHECK (kind IN ('pushups','pullup_stage','bodyweight')),
  value   REAL NOT NULL,
  date    TEXT NOT NULL
);

CREATE TABLE evaluations (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL UNIQUE REFERENCES sessions(id),
  model      TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','ok','failed')),
  summary_md TEXT,
  error      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
