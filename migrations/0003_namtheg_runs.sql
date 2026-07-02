-- Migration 0003 - Namtheg AutoML run storage (S8, PRD 3.7).
-- The ported FastAPI sidecar stores run state and results here instead of
-- Namtheg's local file-based storage.py, so the /namtheg route, the
-- run_automl agent tool, and the sidecar all read the same rows.
--
-- Bulky binaries (the uploaded dataset, engineered CSV, model.joblib, test
-- prediction arrays) stay on the sidecar's scratch disk: a 30 MB CSV cannot
-- fit in a D1 row. Everything a page renders after a run finishes (status,
-- profile/EDA/metrics JSON, result.json, the plot PNG) lives in D1, so a
-- finished run's result page survives a sidecar disk wipe; only re-running
-- inference on a wiped disk requires retraining.

CREATE TABLE IF NOT EXISTS namtheg_runs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'uploaded'
             CHECK (status IN ('uploaded', 'queued', 'running', 'succeeded', 'failed')),
  filename   TEXT,
  target     TEXT,
  error      TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_namtheg_runs_user
  ON namtheg_runs (user_id, created_at DESC);

-- One row per named artifact per run (profile.json, detection.json, eda.json,
-- feature_engineering.json, metrics.json, result.json, plot.png, ...).
-- JSON artifacts store their text in `body`; binary artifacts (the plot)
-- store base64 with is_base64 = 1.
CREATE TABLE IF NOT EXISTS namtheg_artifacts (
  run_id       TEXT NOT NULL REFERENCES namtheg_runs (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/json',
  body         TEXT,
  is_base64    INTEGER NOT NULL DEFAULT 0,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (run_id, name)
);
