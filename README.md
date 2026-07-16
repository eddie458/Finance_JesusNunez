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

The development server proxies `/api` requests to port 8000. Register the first user with `POST /api/auth/register`, or use the included demo login credentials after seeding your own user.

## Test credit-card dates

```sh
php api/tests/BillingCycleTest.php
```
