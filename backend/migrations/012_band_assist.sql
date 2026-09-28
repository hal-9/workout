-- Band-Unterstützung pro Satz: Anzahl Bänder und Nennwert eines Bands (kg).
ALTER TABLE set_logs ADD COLUMN band_count INTEGER;
ALTER TABLE set_logs ADD COLUMN band_kg REAL;
