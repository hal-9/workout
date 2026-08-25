-- Set intent and superset grouping for live workout logging.
ALTER TABLE set_logs ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working';
ALTER TABLE set_logs ADD COLUMN superset_group INTEGER;

-- RIR alongside RPE per exercise in a session.
ALTER TABLE exercise_rpe ADD COLUMN rir INTEGER;

-- Session-scoped adaptations (reorder, skip, replace) and readiness check.
ALTER TABLE sessions ADD COLUMN adaptations_json TEXT;
ALTER TABLE sessions ADD COLUMN readiness_json TEXT;
