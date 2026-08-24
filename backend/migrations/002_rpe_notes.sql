-- RPE pro Übung und Session (nicht pro Satz): eigene Tabelle, damit das
-- Upsert der Satz-Logs den Wert nicht überschreiben kann.
CREATE TABLE exercise_rpe (
  id          INTEGER PRIMARY KEY,
  session_id  INTEGER NOT NULL REFERENCES sessions(id),
  exercise_id TEXT NOT NULL,
  rpe         INTEGER NOT NULL CHECK (rpe BETWEEN 1 AND 10),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, exercise_id)
);

ALTER TABLE sessions ADD COLUMN note TEXT;
