<?php
declare(strict_types=1);

final class AdminBootstrap {
    /** Creates or promotes the administrator configured in api/.env. */
    public static function ensure(PDO $pdo): void {
        $email = filter_var($_ENV['ADMIN_EMAIL'] ?? '', FILTER_VALIDATE_EMAIL);
        $password = $_ENV['ADMIN_PASSWORD'] ?? '';
        $currency = strtoupper($_ENV['ADMIN_BASE_CURRENCY'] ?? 'MXN');

        // Allow the feature to remain disabled when neither setting is present.
        if (!$email && $password === '') return;
        if (!$email || strlen($password) < 8 || !preg_match('/^[A-Z]{3}$/', $currency)) {
            Http::fail('Set a valid ADMIN_EMAIL, an ADMIN_PASSWORD of at least 8 characters, and a 3-letter ADMIN_BASE_CURRENCY in api/.env.', 500);
        }

        $statement = $pdo->prepare('SELECT id, password_hash, role FROM users WHERE email = ?');
        $statement->execute([$email]);
        $existing = $statement->fetch();
        if (!$existing) {
            $pdo->prepare("INSERT INTO users (email, password_hash, base_currency, role) VALUES (?, ?, ?, 'admin')")
                ->execute([$email, password_hash($password, PASSWORD_DEFAULT), $currency]);
            return;
        }

        // The .env credentials are the source of truth for this one administrator.
        if ($existing['role'] !== 'admin' || !password_verify($password, $existing['password_hash'])) {
            $pdo->prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?")
                ->execute([password_hash($password, PASSWORD_DEFAULT), $existing['id']]);
        }
    }
}
