-- Tracks when an insight was resolved (distinct from dismissed_at which means "not relevant")
ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS completed_at timestamptz;
