# Personal Finance Tracker

React/Tailwind frontend and a PHP/PDO REST API built around a single ledger:
income enters an account, expenses leave it, and transfers move money between accounts.

## Run locally

1. Create a MySQL database and import `api/database/schema.sql`.
2. Copy `api/.env.example` to `api/.env` and set its database credentials.
3. Start the API from the repository root:

   ```sh
   php -S localhost:8000 api/router.php
   ```

4. Install and start the client:

   ```sh
   npm install
   npm run dev
   ```

The development server proxies `/api` requests to port 8000. Accounts are created by an administrator from the protected admin page.

## Administrator setup

Public registration is disabled. Apply the role migration once to an existing database:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/001_admin_roles.sql
```

Then set the administrator credentials in `api/.env`:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=choose-a-strong-password
ADMIN_BASE_CURRENCY=MXN
```

On the next API request, the application creates that account (or promotes the matching existing account) to administrator. Updating `ADMIN_PASSWORD` updates that administrator’s password. The **Admin** button in the tracker opens `/admin/`, where administrators can create standard user accounts.

## Staying signed in

A sign-in lasts a week from your last visit, so you stay signed in as long as you open the tracker at least once a week. **Sign out** ends it right away.

Sign-ins are kept in the database’s `sessions` table, which the API creates the first time it needs it. If its database user isn’t allowed to create tables, run this migration once:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/005_sessions.sql
```

Until that table exists, sign-ins use PHP’s session files, which many hosts clear after 24 idle minutes.

## Transactions that don’t change balances

To record income and expenses without linking them to an account, run this migration once on an existing database:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/002_historical_expenses.sql
```

When adding a transaction, select **Don’t change account balances**. It is included in your history and insights but never changes an account balance. To make that the default for every new transaction, turn on **Start every new transaction this way** in the same window; it is saved to your profile, so it applies on every device. That switch needs this migration:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/004_skip_balances_default.sql
```

## Updating an account balance

On the **Accounts** page, **Update balance** sets what an account holds now. The difference is saved as a **Balance adjustment** dated today, so earlier balances and net worth keep their history, and the change never counts as spending or income. It appears in **Transactions** as a transfer, and deleting it there undoes the change. For a credit card, enter the amount you owe.

**Edit** still changes the opening balance, which shifts the account’s whole history.

## Hiding expenses from insights

To let individual income or expenses be left out of the Insights charts on an existing database, run this migration once:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/003_exclude_from_insights.sql
```

If your database has a different name (for example on shared hosting), run only the `ALTER TABLE` statement from that file.

On the Insights page, select a month or category to see the transactions behind it and switch any of them off, or use **Hide from insights** when adding or editing a transaction. Hidden transactions still change account balances, still count on the Overview page, and still count toward net worth and card use; they are only left out of the spending and cash-flow charts.

## Looking at one month in Insights

The **Month** filter at the top of the Insights page sets the month for the Spending and Cash flow tabs. You see that month’s spending pace against the month before, its expense breakdown and category pie, its income, spending and savings, and your net worth at its end. Charts that cover several months keep showing them and mark the chosen one. Selecting a month in a chart changes the filter too. **Cards** always shows the current statement.

## Exporting transactions

On the Transactions page, set any filters, select **Export**, and choose **CSV** or **JSON**. The page opens on the current month, so choose **All months** to see or export everything. The file holds every transaction that matches, not just the rows on screen. On the Insights page, select a month or category and use the download button in the list that opens to export the transactions behind it as CSV, including any hidden from insights.

In a CSV, amounts are signed like the ledger: expenses are negative, income is positive, and transfers are positive. Filter on the **Type** column before adding up a column that includes transfers.

## Editing transactions in a file

Export as **JSON**, edit the file in a text editor or with a script, then select **Import** on the Transactions page and choose the file. Fluent checks the whole file first and lists every change it would make. Nothing is saved until you select **Import** in that list.

- An entry with an `id` updates that transaction, and only the fields that differ from your ledger. An entry can list just the fields to change, for example `{ "id": 412, "category": "Groceries" }`.
- An entry without an `id` is added as a new transaction, and needs at least `date`, `type` and `amount`. If it looks like one already in your ledger (same day, amount, accounts and description), the check says so, which catches a file imported twice.
- Transactions you leave out of the file stay as they are. Importing never deletes anything.
- If any entry has a problem, nothing is imported. The check lists each problem with the entry's position in the file and its id.
- Everything in the file is saved together, or nothing is. If your ledger changes between the check and the import, Fluent checks the file again and shows the new result instead of saving.
- Import a recent export. If you edit a transaction in the app after exporting, the file still has the old values, so the check lists them as changes and importing would undo your edit.

| Field | Value |
| --- | --- |
| `id` | The transaction's number. Leave it out for a new transaction. |
| `date` | The day, written like `2026-11-05`. |
| `type` | `expense`, `income` or `transfer`. |
| `amount` | A positive number with up to two decimals, like `45.5`. The type says which way the money moves. |
| `description` | Text, or `null`. |
| `category` | A category name, or `null` for Uncategorized. Only expenses have one. A name that doesn't exist yet becomes a new category. |
| `from_account` | The account the money leaves, for an expense or a transfer. It has to be an existing account's name. |
| `to_account` | The account the money enters, for income or a transfer. |
| `note` | Text, or `null`. |
| `changes_balances` | `false` for a transaction recorded without an account. |
| `hidden_from_insights` | `true` to leave an expense or income out of the Insights charts. |

Account and category names are matched without regard to capitalization. The `accounts` and `categories` lists at the top of an export are there to copy names from, and importing ignores them. Balance adjustments can be deleted in the app but not edited, so an import refuses changes to them. A file can hold up to 10,000 transactions.

## Test credit-card dates

```sh
php api/tests/BillingCycleTest.php
```

## Test the exports and imports

```sh
npm test
php api/tests/TransactionImportTest.php
```
