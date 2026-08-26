-- Theme-Auswahl pro Nutzer. NULL = App-Default (hell + Lila), damit ein
-- Bestandsnutzer ohne Auswahl nichts Neues zu sehen bekommt.
ALTER TABLE users ADD COLUMN theme_mode TEXT;
ALTER TABLE users ADD COLUMN theme_palette TEXT;
