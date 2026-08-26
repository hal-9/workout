-- Persönliche Anordnung + ausgeblendete Karten im Fortschritt-Tab.
-- NULL = nie angepasst, Frontend nutzt die Default-Reihenfolge.
ALTER TABLE users ADD COLUMN progress_layout_json TEXT;
