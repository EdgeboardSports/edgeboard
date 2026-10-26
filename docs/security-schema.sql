CREATE TABLE IF NOT EXISTS security_usage (bucket TEXT PRIMARY KEY, used INTEGER NOT NULL CHECK(used >= 0));
CREATE TABLE IF NOT EXISTS provider_state (id INTEGER PRIMARY KEY CHECK(id=1), remaining_credits INTEGER NOT NULL CHECK(remaining_credits >= 0));
CREATE TABLE IF NOT EXISTS security_events (event_id TEXT PRIMARY KEY, starts_at INTEGER NOT NULL);
-- The owner must initialize provider_state from a verified provider-dashboard balance.
-- Do not seed an assumed balance or reset budget periods automatically.
