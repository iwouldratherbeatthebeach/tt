CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_name TEXT,
  candidate_email TEXT,
  readiness_band TEXT,
  overall_percent REAL,
  raw_correct INTEGER,
  total_questions INTEGER,
  answered_count INTEGER,
  domain_scores_json TEXT,
  weak_areas_json TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);