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

## Historical expenses

To enable report-only historical expenses on an existing database, run this migration once:

```sh
mysql -u finance_app -p finance_tracker < api/database/migrations/002_historical_expenses.sql
```

When adding an expense, select **Historical entry** if you do not know which account paid it. It is included in spending history and insights but never changes an account balance.

## Test credit-card dates

```sh
php api/tests/BillingCycleTest.php
```
