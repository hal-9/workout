-- Gewichte, die jemand nicht hat („Hab ich nicht" an einem Vorschlag).
-- equipment = Gerät aus der Bibliothek ('kurzhantel') oder 'exercise:<id>'.
-- Die Progression schlägt dann statt des Gewichts eine Wiederholung mehr vor.
CREATE TABLE unavailable_weights (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  equipment  TEXT NOT NULL,
  weight_kg  REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, equipment, weight_kg)
);
