USE finance_tracker;

ALTER TABLE transactions
  ADD COLUMN is_historical BOOLEAN NOT NULL DEFAULT FALSE AFTER occurred_on;
