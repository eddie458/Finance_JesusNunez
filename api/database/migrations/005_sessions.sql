USE finance_tracker;

-- The API creates this table by itself when its database user is allowed to. Run this once if it isn't.
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(256) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  data BLOB NOT NULL,
  last_active INT UNSIGNED NOT NULL,
  INDEX idx_sessions_last_active (last_active)
) ENGINE=InnoDB;
