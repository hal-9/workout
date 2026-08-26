-- M19: Monats-Rückblick (Wrapped) — gesehen-Flag pro Nutzer und Monat.
-- DB statt localStorage, damit der Banner nach Gerätewechsel nicht wiederkommt.
CREATE TABLE wrapped_seen (
  user_id INTEGER NOT NULL REFERENCES users(id),
  month TEXT NOT NULL, -- 'YYYY-MM' (UTC-Konvention wie finished_at)
  seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, month)
);
