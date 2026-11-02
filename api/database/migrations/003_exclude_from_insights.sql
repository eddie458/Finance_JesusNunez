USE finance_tracker;

ALTER TABLE transactions
  ADD COLUMN exclude_from_insights BOOLEAN NOT NULL DEFAULT FALSE AFTER is_historical;
