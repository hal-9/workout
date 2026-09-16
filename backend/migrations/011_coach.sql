-- Strukturierte Coach-Auswertung (JSON) neben dem alten Markdown; alte Zeilen
-- behalten summary_md, neue füllen summary_json.
ALTER TABLE evaluations ADD COLUMN summary_json TEXT;

-- Übernommene Coach-Empfehlungen für die nächste Session mit dieser Übung.
-- Werden beim Finish einer Session gelöscht, die die Übung enthält.
CREATE TABLE coach_hints (
  user_id           INTEGER NOT NULL REFERENCES users(id),
  exercise_id       TEXT NOT NULL,
  field             TEXT NOT NULL CHECK (field IN ('weight_kg','reps','duration_s')),
  value             REAL NOT NULL,
  source_session_id INTEGER REFERENCES sessions(id),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, exercise_id, field)
);
