<?php
declare(strict_types=1);

final class Auth {
    public static function userId(): int {
        session_start();
        if (empty($_SESSION['user_id'])) Http::fail('Authentication required.', 401);
        return (int) $_SESSION['user_id'];
    }
    public static function login(int $id): void { session_start(); session_regenerate_id(true); $_SESSION['user_id'] = $id; }
    public static function logout(): void { session_start(); $_SESSION = []; session_destroy(); }

    public static function currentUser(PDO $pdo): array {
        $id = self::userId();
        $statement = $pdo->prepare('SELECT * FROM users WHERE id = ?');
        $statement->execute([$id]);
        $user = $statement->fetch() ?: Http::fail('Authentication required.', 401);
        // Reading * keeps sign-in working on databases that have not run the 004 preferences migration yet.
        return ['id' => $user['id'], 'email' => $user['email'], 'base_currency' => $user['base_currency'], 'role' => $user['role'], 'skip_balances_by_default' => (int)($user['skip_balances_by_default'] ?? 0)];
    }

    public static function requireAdmin(PDO $pdo): array {
        $user = self::currentUser($pdo);
        if ($user['role'] !== 'admin') Http::fail('Administrator access required.', 403);
        return $user;
    }
}
