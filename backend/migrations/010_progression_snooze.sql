-- Verschobene Progressions-Empfehlungen. until_date = erster Tag (Europe/Berlin),
-- an dem der Vorschlag wieder erscheint; abgelaufene Zeilen werden beim Lesen entfernt.
CREATE TABLE progression_snoozes (
  user_id     INTEGER NOT NULL REFERENCES users(id),
  exercise_id TEXT NOT NULL,
  until_date  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, exercise_id)
);
