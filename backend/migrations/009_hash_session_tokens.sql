-- Session-Tokens liegen ab jetzt nur noch als SHA-256-Hash in der DB.
-- Bestehende Zeilen enthalten rohe Tokens und passen zu keinem Lookup mehr:
-- weg damit, alle Nutzer melden sich einmal neu an.
DELETE FROM auth_sessions;
