USE finance_tracker;

ALTER TABLE users
  ADD COLUMN skip_balances_by_default BOOLEAN NOT NULL DEFAULT FALSE AFTER role;
