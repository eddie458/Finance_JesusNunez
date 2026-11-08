<?php
declare(strict_types=1);

final class Auth {
    public const LIFETIME = 604800; // a week, in seconds: how long a sign-in lasts after the last visit
    private const RENEW_AFTER = 3600; // seconds between moving that week forward

    public static function userId(): int {
        if (!self::resume()) Http::fail('Authentication required.', 401);
        self::renew();
        return (int) $_SESSION['user_id'];
    }
    public static function login(int $id): void { self::start(); session_regenerate_id(true); $_SESSION['user_id'] = $id; $_SESSION['renewed_at'] = time(); }
    public static function logout(): void {
        if (!isset($_COOKIE[session_name()])) return;
        self::start(); $_SESSION = []; session_destroy();
        setcookie(session_name(), '', self::cookie()); // an empty value tells the browser to delete it
    }

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

    // Sessions last a week in the database, with a cookie that lasts as long. Strict mode refuses a session id the server never handed out.
    private static function start(): void {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        ini_set('session.use_strict_mode', '1'); ini_set('session.gc_maxlifetime', (string) self::LIFETIME);
        // Secure when the request came over HTTPS, or when the host's PHP settings already say so.
        $secure = filter_var(ini_get('session.cookie_secure'), FILTER_VALIDATE_BOOLEAN) || (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off');
        session_set_cookie_params(['lifetime' => self::LIFETIME, 'path' => '/', 'domain' => '', 'secure' => $secure, 'httponly' => true, 'samesite' => 'Lax']);
        $store = SessionStore::connect(Database::connection(), self::LIFETIME);
        if ($store) { ini_set('session.gc_probability', '1'); ini_set('session.gc_divisor', '100'); session_set_save_handler($store, true); }
        session_start();
    }

    // A request without a session cookie isn't signed in, and starting a session for it would only keep an empty one.
    private static function resume(): bool {
        if (!isset($_COOKIE[session_name()])) return false;
        self::start();
        if (!empty($_SESSION['user_id'])) return true;
        // The sign-in expired or never existed. Answer without handing out a new cookie.
        session_abort(); header_remove('Set-Cookie');
        return false;
    }

    // Moves the expiry forward once an hour, so the week counts from the last visit rather than from signing in.
    private static function renew(): void {
        if (($_SESSION['renewed_at'] ?? 0) > time() - self::RENEW_AFTER) return;
        $_SESSION['renewed_at'] = time();
        setcookie(session_name(), session_id(), ['expires' => time() + self::LIFETIME] + self::cookie());
    }

    // The session cookie's own settings, so a renewed or deleted cookie replaces it rather than sitting beside it.
    private static function cookie(): array { $params = session_get_cookie_params(); unset($params['lifetime']); return $params; }
}
