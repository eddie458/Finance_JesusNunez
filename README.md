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

## Transactions that don’t change balances

To record income and expenses without linking them to an account, run this migration once on an existing database:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/002_historical_expenses.sql
```

When adding a transaction, select **Don’t change account balances**. It is included in your history and insights but never changes an account balance. To make that the default for every new transaction, turn on **Start every new transaction this way** in the same window; it is saved to your profile, so it applies on every device. That switch needs this migration:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/004_skip_balances_default.sql
```

## Hiding expenses from insights

To let individual income or expenses be left out of the Insights charts on an existing database, run this migration once:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/003_exclude_from_insights.sql
```

If your database has a different name (for example on shared hosting), run only the `ALTER TABLE` statement from that file.

On the Insights page, select a bar to see the transactions behind it and switch any of them off, or use **Hide from insights** when adding or editing a transaction. Hidden transactions still change account balances, still count on the Overview page, and still count toward net worth and card use; they are only left out of the spending and cash-flow charts.

## Exporting transactions

On the Transactions page, set any filters and select **Export CSV**. The file holds every transaction that matches, not just the rows on screen. On the Insights page, select a bar and use the download button in the list that opens to export the transactions behind it, including any hidden from insights.

Amounts are signed like the ledger: expenses are negative, income is positive, and transfers are positive. Filter on the **Type** column before adding up a column that includes transfers.

## Test credit-card dates

```sh
php api/tests/BillingCycleTest.php
```

## Test the CSV export

```sh
npm test
```
