-- Registrierung: E-Mail als Login-Kennung. Nullable, weil die Bestandsnutzer
-- (per Seed angelegt) noch keine haben und sich bis zum Backfill weiter mit
-- ihrem Namen anmelden.
ALTER TABLE users ADD COLUMN email TEXT;

-- E-Mails werden immer kleingeschrieben gespeichert, deshalb reicht ein
-- normaler Unique-Index. Partiell, damit mehrere NULL-Zeilen erlaubt bleiben.
CREATE UNIQUE INDEX idx_users_email ON users (email) WHERE email IS NOT NULL;

-- Tutorial-Screens beim ersten Login. Bestandsnutzer haben die App schon
-- gesehen und sollen das Onboarding nicht bekommen.
ALTER TABLE users ADD COLUMN onboarded_at TEXT;
UPDATE users SET onboarded_at = datetime('now');

-- Gegenseitige Freundschaft: Anfrage (pending) -> Annahme (accepted).
-- Ablehnen und Entfernen loeschen die Zeile, damit erneut angefragt werden kann.
CREATE TABLE friendships (
  id           INTEGER PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  addressee_id INTEGER NOT NULL REFERENCES users(id),
  status       TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT,
  CHECK (requester_id != addressee_id),
  UNIQUE (requester_id, addressee_id)
);

CREATE INDEX idx_friendships_addressee ON friendships (addressee_id, status);
CREATE INDEX idx_friendships_requester ON friendships (requester_id, status);
