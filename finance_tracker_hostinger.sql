
CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  base_currency CHAR(3) NOT NULL DEFAULT 'MXN',
  role ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  type ENUM('cash','savings','debit','credit','investment') NOT NULL,
  opening_balance_cents BIGINT NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_accounts_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_accounts_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE credit_card_details (
  account_id BIGINT UNSIGNED PRIMARY KEY,
  credit_limit_cents BIGINT NOT NULL,
  statement_day TINYINT UNSIGNED NOT NULL,
  due_day TINYINT UNSIGNED NOT NULL,
  CONSTRAINT fk_card_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
  CHECK (statement_day BETWEEN 1 AND 31), CHECK (due_day BETWEEN 1 AND 31)
) ENGINE=InnoDB;

CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_categories_user_name (user_id, name)
) ENGINE=InnoDB;

CREATE TABLE transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  type ENUM('expense','income','transfer') NOT NULL,
  amount_cents BIGINT NOT NULL,
  occurred_on DATE NOT NULL,
  is_historical BOOLEAN NOT NULL DEFAULT FALSE,
  from_account_id BIGINT UNSIGNED NULL,
  to_account_id BIGINT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NULL,
  merchant VARCHAR(120) NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_transactions_from FOREIGN KEY (from_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_transactions_to FOREIGN KEY (to_account_id) REFERENCES accounts(id),
  CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES categories(id),
  CHECK (amount_cents > 0),
  INDEX idx_txn_user_date (user_id, occurred_on),
  INDEX idx_txn_user_cat (user_id, category_id),
  INDEX idx_txn_user_from (user_id, from_account_id),
  INDEX idx_txn_user_to (user_id, to_account_id)
) ENGINE=InnoDB;
